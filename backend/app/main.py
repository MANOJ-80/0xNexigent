import asyncio
import json
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from redis.asyncio import Redis
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .auth import create_access_token, decode_access_token
from .config import settings
from .database import SessionLocal, engine, get_db
from .models import AdminRole, Agent, AgentStatus, Base, Budget, Decision, Incident, IncidentSeverity, IncidentStatus, LedgerEvent, Organization, RequestLog, Session, SessionStatus, Team, Webhook, WebhookDelivery
from .schemas import AgentCreate, AgentUpdate, AgentUpdateBudget, AuthLoginRequest, ChatCompletionRequest, DemoRunRequest, IncidentAction, TeamCreate, TeamUpdateBudget, TokenResponse, WebhookCreate, WebhookUpdate
from .services import agent_from_key, cleanup_stale_reservations, execute, generate_agent_key, key_hash, str_val, trigger_webhooks, validate_webhook_url, microdollars_to_usd, release_and_charge

app = FastAPI(title="0xNexigent", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins.split(","), allow_methods=["*"], allow_headers=["*"])
redis = Redis.from_url(settings.redis_url, decode_responses=True)


async def get_admin_user(
    x_admin_role: str = Header(default="ADMIN", alias="X-Admin-Role"),
    x_admin_key: str = Header(default="", alias="X-Admin-Key"),
    authorization: str = Header(default=""),
    token: str | None = Query(default=None),
) -> str:
    if authorization.startswith("Bearer nx_ag_") or authorization.startswith("Bearer nx_demo_"):
        raise HTTPException(403, detail={"code": "FORBIDDEN", "message": "Agent gateway API keys cannot access administrative management endpoints."})

    provided_token = ""
    if authorization.startswith("Bearer "):
        provided_token = authorization.removeprefix("Bearer ").strip()
    elif token:
        provided_token = token.strip()
    elif x_admin_key:
        provided_token = x_admin_key.strip()

    # 1. Attempt JWT decoding
    if provided_token and provided_token.count(".") == 2:
        try:
            payload = decode_access_token(provided_token)
            role = payload.get("role", "ADMIN").upper()
            if role in ["ADMIN", "OPERATOR", "VIEWER"]:
                return role
        except HTTPException:
            raise
        except Exception:
            pass

    raise HTTPException(401, detail={"code": "AUTHENTICATION_FAILED", "message": "Valid JWT access token required in Authorization header."})


def require_role(allowed_roles: list[str]):
    async def dep(role: str = Depends(get_admin_user)):
        if role not in allowed_roles:
            raise HTTPException(403, detail={"code": "FORBIDDEN", "message": f"Role '{role}' is not authorized for this action. Required: {allowed_roles}"})
        return role
    return dep


@app.post("/api/auth/login", response_model=TokenResponse)
async def auth_login(payload: AuthLoginRequest):
    expected_key = settings.admin_api_key or "change-me-before-deploying"
    provided_secret = payload.admin_key or payload.password
    
    if provided_secret != expected_key:
        raise HTTPException(401, detail={"code": "INVALID_CREDENTIALS", "message": "Invalid administrative key or password."})

    target_role = "ADMIN"

    token = create_access_token({"sub": payload.username or "admin-user", "role": target_role})
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in=settings.jwt_expiration_minutes * 60,
        role=target_role
    )


@app.get("/api/auth/me")
async def auth_me(role: str = Depends(get_admin_user)):
    return {"status": "authenticated", "role": role}



async def seed_acme_org(db: AsyncSession) -> None:
    if not await db.scalar(select(Organization).limit(1)):
        org = Organization(name="Acme Engineering")
        db.add(org)
        await db.flush()
        products = [
            ("Research", ["research-agent", "analyst-agent", "report-agent"]),
            ("Support", ["support-agent", "triage-agent", "knowledge-agent"]),
            ("Development", ["code-review-agent", "test-agent", "deploy-agent"]),
            ("Operations", ["monitor-agent", "incident-agent", "loop-agent"]),
        ]
        for product, slugs in products:
            team = Team(organization_id=org.id, name=f"{product} Team", product=product)
            db.add(team)
            await db.flush()
            db.add(Budget(scope_type="team", scope_id=team.id, limit_usd=500.00))
            for slug in slugs:
                raw_key = f"nx_demo_{slug}"
                prefix = f"nx_demo_{slug[:4]}...{slug[-2:]}"
                agent = Agent(
                    team_id=team.id,
                    slug=slug,
                    name=slug.replace("-", " ").title(),
                    api_key_hash=key_hash(raw_key),
                    key_prefix=prefix,
                    preferred_model="openai/gpt-oss-120b",
                    fallback_model="openai/gpt-oss-20b",
                    default_session_budget=2.00,
                    warning_percent=80,
                    status="ACTIVE",
                )
                db.add(agent)
                await db.flush()
                db.add(Budget(scope_type="agent", scope_id=agent.id, limit_usd=50.00))
        await db.commit()


@app.on_event("startup")
async def startup() -> None:
    # Schema changes are applied by Alembic before production startup; create_all is only a local-dev convenience.
    if settings.environment.lower() != "production":
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    async with SessionLocal() as db:
        await seed_acme_org(db)


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.get("/ready")
async def ready():
    try:
        await redis.ping()
        async with SessionLocal() as db:
            await db.execute(select(1))
        return {"status": "ready", "groq_configured": bool(settings.groq_api_key)}
    except Exception as error:
        raise HTTPException(503, detail=str(error))


@app.post("/v1/chat/completions")
@app.post("/api/v1/chat/completions")
async def chat_completions(
    payload: ChatCompletionRequest,
    authorization: str = Header(default=""),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    x_idempotency_key: str | None = Header(default=None, alias="X-Idempotency-Key"),
    db: AsyncSession = Depends(get_db),
):
    key = idempotency_key or x_idempotency_key
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, detail={"code": "AUTHENTICATION_FAILED", "message": "Bearer gateway API key required."})
    agent = await agent_from_key(db, authorization.removeprefix("Bearer "))

    cache_key = f"idempotency:{agent.id}:{key}" if key else None
    lock_key = f"idempotency-lock:{agent.id}:{key}" if key else None
    if cache_key:
        cached = await redis.get(cache_key)
        if cached:
            parsed = json.loads(cached)
            return JSONResponse(parsed["body"], headers={**parsed["headers"], "X-Cache": "HIT"})
        if not await redis.set(lock_key, "1", ex=90, nx=True):
            raise HTTPException(409, detail={"code": "IDEMPOTENCY_IN_PROGRESS", "message": "An identical request is already being processed."})

    try:
        response, decision, selected, request_id, est_cost, act_cost, warnings = await execute(db, redis, agent, payload, idempotency_key=key)
        headers = {
            "X-Nexigent-Request-ID": str(request_id),
            "X-Nexigent-Decision": str_val(decision),
            "X-Nexigent-Requested-Model": payload.model,
            "X-Nexigent-Selected-Model": selected,
            "X-Nexigent-Estimated-Cost": str(est_cost),
            "X-Nexigent-Actual-Cost": str(act_cost),
        }
        if warnings:
            headers["X-Nexigent-Warning"] = json.dumps(warnings)
        if cache_key:
            await redis.set(cache_key, json.dumps({"body": response, "headers": headers}), ex=86400)
        return JSONResponse(response, headers=headers)
    finally:
        if lock_key:
            await redis.delete(lock_key)

@app.post("/api/demo/run")
async def demo_run(payload: DemoRunRequest, db: AsyncSession = Depends(get_db), role: str = Depends(require_role(["ADMIN", "OPERATOR"]))):
    agent = await db.scalar(select(Agent).where(Agent.slug == payload.agent_slug))
    if not agent:
        raise HTTPException(404, detail="Demo agent not found")
    request = ChatCompletionRequest(
        model=agent.preferred_model, session_id=payload.session_id, max_tokens=payload.max_tokens, messages=[{"role": "user", "content": payload.prompt}]
    )
    response, decision, selected, request_id, est_cost, act_cost, warnings = await execute(db, redis, agent, request)
    return {"request_id": request_id, "decision": str_val(decision), "model": selected, "response": response, "warnings": warnings}


async def set_demo_session_budget(db: AsyncSession, agent: Agent, session_id: str, limit: float) -> None:
    session_scope = uuid.uuid5(agent.id, session_id)
    budget = await db.scalar(select(Budget).where((Budget.scope_type == "session") & (Budget.scope_id == session_scope)))
    if not budget:
        budget = Budget(scope_type="session", scope_id=session_scope, period="session", limit_usd=limit)
        db.add(budget)
    else:
        budget.limit_usd, budget.spent_usd, budget.reserved_usd, budget.warning_sent = limit, 0, 0, False
    
    session_record = await db.scalar(select(Session).where((Session.agent_id == agent.id) & (Session.external_id == session_id)))
    if not session_record:
        session_record = Session(agent_id=agent.id, external_id=session_id, budget_limit=limit, status="ACTIVE", spent=0, reserved=0)
        db.add(session_record)
    else:
        session_record.status = "ACTIVE"
        session_record.closed_at = None
        session_record.spent = 0
        session_record.reserved = 0
        session_record.budget_limit = limit

    await db.commit()
    await redis.delete(f"budget:{budget.id}")


@app.post("/api/demo/scenarios/{scenario}")
async def run_scenario(scenario: str, db: AsyncSession = Depends(get_db), role: str = Depends(require_role(["ADMIN", "OPERATOR"]))):
    presets = {
        "reroute": ("support-agent", "reroute-real", 0.000055),
        "block": ("support-agent", "block-real", 0.000010),
        "warning": ("research-agent", "warning-real", 0.000030),
        "runaway": ("loop-agent", "runaway-real", 0.001000),
    }
    if scenario not in presets:
        raise HTTPException(404, detail="Unknown scenario")
    slug, session_id, session_limit = presets[scenario]
    agent = await db.scalar(select(Agent).where(Agent.slug == slug))
    if scenario == "runaway":
        agent_budget = await db.scalar(select(Budget).where((Budget.scope_type == "agent") & (Budget.scope_id == agent.id)))
        agent_budget.limit_usd, agent_budget.spent_usd, agent_budget.reserved_usd, agent_budget.warning_sent = 0.000200, 0, 0, False
        await db.commit()
        await redis.delete(f"budget:{agent_budget.id}")
        await redis.delete(f"agent-hourly-micro:{agent.id}")
    elif scenario in ["reroute", "block"]:
        agent_budget = await db.scalar(select(Budget).where((Budget.scope_type == "agent") & (Budget.scope_id == agent.id)))
        if agent_budget:
            agent_budget.limit_usd = Decimal("0.04")
            agent_budget.spent_usd, agent_budget.reserved_usd, agent_budget.warning_sent = 0, 0, False
            await db.commit()
            await redis.delete(f"budget:{agent_budget.id}")
    await set_demo_session_budget(db, agent, session_id, session_limit)
    if scenario == "warning":
        payload = ChatCompletionRequest(
            model=agent.preferred_model,
            session_id=session_id,
            max_tokens=2,
            messages=[{"role": "user", "content": "Explain pre-execution LLM spend control in exactly one word. " * 20}],
        )
    else:
        payload = ChatCompletionRequest(
            model=agent.preferred_model,
            session_id=session_id,
            max_tokens=100,
            messages=[{"role": "user", "content": "In one sentence, explain why pre-execution LLM spend control matters."}],
        )
    response, decision, selected, request_id, est_cost, act_cost, warnings = await execute(db, redis, agent, payload)
    return {"scenario": scenario, "request_id": request_id, "decision": str_val(decision), "model": selected, "response": response, "warnings": warnings}


@app.post("/api/demo/reset")
async def demo_reset(db: AsyncSession = Depends(get_db), role: str = Depends(require_role(["ADMIN"]))):
    allowed_slugs = {
        "research-agent", "analyst-agent", "report-agent",
        "support-agent", "triage-agent", "knowledge-agent",
        "code-review-agent", "test-agent", "deploy-agent",
        "monitor-agent", "incident-agent", "loop-agent"
    }
    allowed_teams = {"Research Team", "Support Team", "Development Team", "Operations Team"}

    await db.execute(delete(Session))
    await db.execute(delete(RequestLog))
    await db.execute(delete(Incident))
    await db.execute(delete(LedgerEvent))

    # Delete extra non-seed agents
    extra_agents = list((await db.scalars(select(Agent).where(Agent.slug.not_in(allowed_slugs)))).all())
    for ea in extra_agents:
        await db.execute(delete(Budget).where(Budget.scope_id == ea.id, Budget.scope_type == "agent"))
        await db.delete(ea)

    # Delete extra non-seed teams
    extra_teams = list((await db.scalars(select(Team).where(Team.name.not_in(allowed_teams)))).all())
    for et in extra_teams:
        await db.execute(delete(Budget).where(Budget.scope_id == et.id, Budget.scope_type == "team"))
        await db.delete(et)

    agents = list((await db.scalars(select(Agent))).all())
    for a in agents:
        a.status = "ACTIVE"
        await redis.delete(f"agent-hourly-micro:{a.id}")

    await db.execute(delete(Budget).where(Budget.scope_type == "session"))

    budgets = list((await db.scalars(select(Budget))).all())
    for b in budgets:
        b.spent_usd = 0
        b.reserved_usd = 0
        b.warning_sent = False
        if b.scope_type == "team":
            b.limit_usd = Decimal("500.00")
        elif b.scope_type == "agent":
            b.limit_usd = Decimal("50.00")
        await redis.delete(f"budget:{b.id}")

    try:
        await redis.flushdb()
    except Exception:
        pass

    db.add(LedgerEvent(event_type="DEMO_SYSTEM_RESET", metadata_json={"actor": "admin", "timestamp": datetime.now(timezone.utc).isoformat()}))
    await db.commit()
    return {"status": "DEMO_STATE_RESET_SUCCESSFUL", "agents": len(agents)}


@app.get("/api/overview")
async def overview(db: AsyncSession = Depends(get_db), role: str = Depends(require_role(["ADMIN", "OPERATOR", "VIEWER"]))):
    budgets = list((await db.scalars(select(Budget))).all())
    agents = list((await db.scalars(select(Agent))).all())
    requests = list((await db.scalars(select(RequestLog).order_by(RequestLog.created_at.desc()).limit(12))).all())
    return {
        "metrics": {
            "spent": float(sum(float(b.spent_usd) for b in budgets if b.scope_type == "team")),
            "reserved": float(sum(float(b.reserved_usd) for b in budgets if b.scope_type == "team")),
            "agents": len(agents),
            "requests": await db.scalar(select(func.count(RequestLog.id))),
            "blocks": await db.scalar(select(func.count(RequestLog.id)).where(RequestLog.decision == "BLOCK")),
            "warnings": await db.scalar(select(func.count(LedgerEvent.id)).where(LedgerEvent.event_type == "BUDGET_WARNING")),
        },
        "budgets": [
            {
                "id": str(b.id),
                "scope": b.scope_type,
                "limit": float(b.limit_usd),
                "spent": float(b.spent_usd),
                "reserved": float(b.reserved_usd),
                "percent": round((float(b.spent_usd) + float(b.reserved_usd)) / float(b.limit_usd) * 100, 1) if b.limit_usd else 0,
            }
            for b in budgets
        ],
        "agents": [
            {"slug": a.slug, "name": a.name, "status": str_val(a.status), "preferred_model": a.preferred_model, "fallback_model": a.fallback_model}
            for a in agents
        ],
        "requests": [
            {
                "id": str(r.id),
                "decision": str_val(r.decision),
                "requested": r.requested_model,
                "selected": r.selected_model,
                "actual": float(r.actual_cost_usd or 0),
                "created_at": r.created_at,
            }
            for r in requests
        ],
    }


# --- SESSION LIFECYCLE APIs ---

@app.get("/api/sessions")
async def list_sessions(
    agent_slug: str | None = Query(default=None),
    status: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    role: str = Depends(require_role(["ADMIN", "OPERATOR", "VIEWER"]))
):
    query = select(Session).order_by(Session.opened_at.desc())
    if status and status.upper() in ["ACTIVE", "EXHAUSTED", "CLOSED"]:
        query = query.where(Session.status == status.upper())
    
    sessions = list((await db.scalars(query.limit(100))).all())
    result = []
    for s in sessions:
        agent = await db.scalar(select(Agent).where(Agent.id == s.agent_id))
        if agent_slug and agent and agent.slug != agent_slug:
            continue
        team = await db.scalar(select(Team).where(Team.id == agent.team_id)) if agent else None
        result.append({
            "id": str(s.id),
            "agent_slug": agent.slug if agent else "—",
            "agent_name": agent.name if agent else "—",
            "team_name": team.name if team else "—",
            "external_id": s.external_id,
            "status": str_val(s.status),
            "budget_limit": float(s.budget_limit),
            "spent": float(s.spent),
            "reserved": float(s.reserved),
            "started_at": s.opened_at,
            "ended_at": s.closed_at,
        })
    return result


@app.get("/api/sessions/{session_id}")
async def get_session_detail(session_id: str, db: AsyncSession = Depends(get_db), role: str = Depends(require_role(["ADMIN", "OPERATOR", "VIEWER"]))):
    session_uuid = uuid.UUID(session_id) if "-" in session_id and len(session_id) == 36 else None
    if session_uuid:
        s = await db.scalar(select(Session).where(Session.id == session_uuid))
    else:
        s = await db.scalar(select(Session).where(Session.external_id == session_id))
    if not s:
        raise HTTPException(404, detail="Session not found")

    agent = await db.scalar(select(Agent).where(Agent.id == s.agent_id))
    team = await db.scalar(select(Team).where(Team.id == agent.team_id)) if agent else None
    requests = list((await db.scalars(select(RequestLog).where(RequestLog.session_id == s.external_id).order_by(RequestLog.created_at.desc()))).all())

    return {
        "id": str(s.id),
        "external_id": s.external_id,
        "agent": {"slug": agent.slug, "name": agent.name} if agent else None,
        "team": {"name": team.name, "product": team.product} if team else None,
        "status": str_val(s.status),
        "budget_limit": float(s.budget_limit),
        "spent": float(s.spent),
        "reserved": float(s.reserved),
        "started_at": s.opened_at,
        "ended_at": s.closed_at,
        "total_requests": len(requests),
        "requests": [
            {
                "id": str(r.id),
                "requested_model": r.requested_model,
                "selected_model": r.selected_model,
                "decision": str_val(r.decision),
                "actual_cost": float(r.actual_cost_usd or 0),
                "created_at": r.created_at,
            }
            for r in requests
        ],
    }


@app.post("/api/sessions/{session_id}/close")
async def close_session(session_id: str, db: AsyncSession = Depends(get_db), role: str = Depends(require_role(["ADMIN", "OPERATOR"]))):
    session_uuid = uuid.UUID(session_id) if "-" in session_id and len(session_id) == 36 else None
    if session_uuid:
        s = await db.scalar(select(Session).where(Session.id == session_uuid))
    else:
        s = await db.scalar(select(Session).where(Session.external_id == session_id))
    if not s:
        raise HTTPException(404, detail="Session not found")

    s.status = "CLOSED"
    s.closed_at = datetime.now(timezone.utc)
    agent = await db.scalar(select(Agent).where(Agent.id == s.agent_id))
    db.add(LedgerEvent(event_type="SESSION_CLOSED", metadata_json={"agent": agent.slug if agent else "—", "session_id": s.external_id, "actor": "user"}))
    await db.commit()
    return {"id": str(s.id), "external_id": s.external_id, "status": str_val(s.status), "closed_at": s.closed_at}


@app.put("/api/sessions/{session_id}/budget")
async def update_session_budget(session_id: str, payload: dict, db: AsyncSession = Depends(get_db), role: str = Depends(require_role(["ADMIN", "OPERATOR"]))):
    session_uuid = uuid.UUID(session_id) if "-" in session_id and len(session_id) == 36 else None
    if session_uuid:
        s = await db.scalar(select(Session).where(Session.id == session_uuid))
    else:
        s = await db.scalar(select(Session).where(Session.external_id == session_id))

    limit_usd = payload.get("limit_usd", 0.01)
    agent_slug = payload.get("agent_slug")

    if not s:
        agent = None
        if agent_slug:
            agent = await db.scalar(select(Agent).where(Agent.slug == agent_slug))
        if not agent:
            agent = await db.scalar(select(Agent).limit(1))
        if agent:
            await set_demo_session_budget(db, agent, session_id, limit_usd)
            s = await db.scalar(select(Session).where(Session.external_id == session_id))
            return {"id": str(s.id), "external_id": s.external_id, "budget_limit": float(s.budget_limit), "status": str_val(s.status)}
        else:
            raise HTTPException(404, detail="Agent not found to initialize session")

    if limit_usd is not None:
        s.budget_limit = limit_usd
        s.status = "ACTIVE"
        s.closed_at = None
        s.spent = 0
        s.reserved = 0
        agent = await db.scalar(select(Agent).where(Agent.id == s.agent_id))
        if agent:
            session_scope = uuid.uuid5(agent.id, s.external_id)
            budget = await db.scalar(select(Budget).where((Budget.scope_type == "session") & (Budget.scope_id == session_scope)))
            if not budget:
                budget = Budget(scope_type="session", scope_id=session_scope, period="session", limit_usd=limit_usd)
                db.add(budget)
            else:
                budget.limit_usd = limit_usd
                budget.spent_usd = Decimal(0)
                budget.reserved_usd = Decimal(0)
                budget.warning_sent = False
                await redis.delete(f"budget:{budget.id}")
        db.add(LedgerEvent(event_type="SESSION_BUDGET_UPDATED", metadata_json={"session_id": s.external_id, "new_limit_usd": limit_usd}))
        await db.commit()
    return {"id": str(s.id), "external_id": s.external_id, "budget_limit": float(s.budget_limit), "status": str_val(s.status)}


@app.post("/api/sessions/{session_id}/reset")
async def reset_session_budget(session_id: str, db: AsyncSession = Depends(get_db), role: str = Depends(require_role(["ADMIN", "OPERATOR"]))):
    session_uuid = uuid.UUID(session_id) if "-" in session_id and len(session_id) == 36 else None
    if session_uuid:
        s = await db.scalar(select(Session).where(Session.id == session_uuid))
    else:
        s = await db.scalar(select(Session).where(Session.external_id == session_id))
    
    if s:
        s.spent = 0
        s.reserved = 0
        s.status = "ACTIVE"
        s.closed_at = None
        agent = await db.scalar(select(Agent).where(Agent.id == s.agent_id))
        if agent:
            session_scope = uuid.uuid5(agent.id, s.external_id)
            budget = await db.scalar(select(Budget).where((Budget.scope_type == "session") & (Budget.scope_id == session_scope)))
            if budget:
                budget.spent_usd = Decimal(0)
                budget.reserved_usd = Decimal(0)
                budget.warning_sent = False
                await redis.delete(f"budget:{budget.id}")

            agent_budget = await db.scalar(select(Budget).where((Budget.scope_type == "agent") & (Budget.scope_id == agent.id)))
            if agent_budget:
                agent_budget.spent_usd = Decimal(0)
                agent_budget.reserved_usd = Decimal(0)
                agent_budget.warning_sent = False
                await redis.delete(f"budget:{agent_budget.id}")

        db.add(LedgerEvent(event_type="SESSION_RESET", metadata_json={"session_id": s.external_id, "actor": "user"}))
        await db.commit()
        return {"id": str(s.id), "external_id": s.external_id, "status": "ACTIVE", "spent": 0}
    else:
        await redis.flushdb()
        return {"status": "ACTIVE", "spent": 0}



# --- REQUEST AUDIT & FILTERS APIs ---

@app.get("/api/requests")
async def list_requests(
    agent_slug: str | None = Query(default=None),
    decision: str | None = Query(default=None),
    requested_model: str | None = Query(default=None),
    actual_model: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    role: str = Depends(require_role(["ADMIN", "OPERATOR", "VIEWER"]))
):
    query = select(RequestLog).order_by(RequestLog.created_at.desc()).limit(100)
    if decision:
        query = query.where(RequestLog.decision == decision.upper())
    if requested_model:
        query = query.where(RequestLog.requested_model == requested_model)
    if actual_model:
        query = query.where(RequestLog.selected_model == actual_model)

    requests = list((await db.scalars(query)).all())
    result = []
    for r in requests:
        agent = await db.scalar(select(Agent).where(Agent.id == r.agent_id))
        if agent_slug and agent and agent.slug != agent_slug:
            continue
        result.append({
            "id": str(r.id),
            "agent_slug": agent.slug if agent else "—",
            "agent_name": agent.name if agent else "—",
            "session_id": r.session_id,
            "requested_model": r.requested_model,
            "selected_model": r.selected_model,
            "decision": str_val(r.decision),
            "reason": r.reason,
            "estimated_cost": float(r.estimated_cost_usd or 0),
            "actual_cost": float(r.actual_cost_usd or 0),
            "created_at": r.created_at,
        })
    return result


@app.get("/api/requests/{request_id}")
async def request_detail(request_id: str, db: AsyncSession = Depends(get_db), role: str = Depends(require_role(["ADMIN", "OPERATOR", "VIEWER"]))):
    req = await db.scalar(select(RequestLog).where(RequestLog.id == uuid.UUID(request_id)))
    if not req:
        raise HTTPException(404, detail="Request not found")
    agent = await db.scalar(select(Agent).where(Agent.id == req.agent_id))
    team = await db.scalar(select(Team).where(Team.id == agent.team_id)) if agent else None
    events = list((await db.scalars(select(LedgerEvent).where(LedgerEvent.request_id == req.id).order_by(LedgerEvent.created_at))).all())

    dec_str = str_val(req.decision)
    sequence = ["RECEIVED", "RESERVED"]
    if dec_str == "REROUTE":
        sequence.append("MODEL_REROUTED")
    if dec_str in ["ALLOW", "REROUTE"]:
        sequence.append("GROQ_EXECUTED")
        sequence.append("USAGE_RECONCILED")
    else:
        sequence.append(f"REQUEST_{dec_str}")

    return {
        "id": str(req.id),
        "agent": {"slug": agent.slug, "name": agent.name} if agent else None,
        "team": {"name": team.name, "product": team.product} if team else None,
        "session_id": req.session_id,
        "requested_model": req.requested_model,
        "selected_model": req.selected_model,
        "decision": dec_str,
        "reason": req.reason,
        "estimated_cost": float(req.estimated_cost_usd or 0),
        "actual_cost": float(req.actual_cost_usd or 0),
        "input_tokens": req.input_tokens,
        "output_tokens": req.output_tokens,
        "reasoning_tokens": req.reasoning_tokens,
        "cached_tokens": req.cached_tokens,
        "provider_request_id": req.provider_request_id,
        "idempotency_key": req.idempotency_key,
        "cache_hit": req.cache_hit,
        "reservation_status": req.reservation_status,
        "sequence_visual": sequence,
        "created_at": req.created_at,
        "ledger_events": [{"id": str(e.id), "event_type": e.event_type, "metadata": e.metadata_json, "created_at": e.created_at} for e in events],
    }


# --- INCIDENT MANAGEMENT WORKFLOW APIs ---

@app.get("/api/incidents")
async def list_incidents(
    status: str | None = Query(default=None),
    agent_slug: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    role: str = Depends(require_role(["ADMIN", "OPERATOR", "VIEWER"]))
):
    query = select(Incident).order_by(Incident.created_at.desc())
    if status:
        query = query.where(Incident.status == status.upper())
    
    incidents = list((await db.scalars(query.limit(50))).all())
    result = []
    for inc in incidents:
        agent = await db.scalar(select(Agent).where(Agent.id == inc.agent_id))
        if agent_slug and agent and agent.slug != agent_slug:
            continue
        team = await db.scalar(select(Team).where(Team.id == inc.team_id)) if inc.team_id else (await db.scalar(select(Team).where(Team.id == agent.team_id)) if agent else None)
        result.append({
            "id": str(inc.id),
            "agent_slug": agent.slug if agent else "—",
            "agent_name": agent.name if agent else "—",
            "team_name": team.name if team else "—",
            "kind": inc.kind,
            "severity": str_val(inc.severity),
            "status": str_val(inc.status),
            "reviewer": inc.reviewer,
            "metadata": inc.metadata_json,
            "created_at": inc.created_at,
            "resolved_at": inc.resolved_at,
        })
    return result


@app.get("/api/incidents/{incident_id}")
async def get_incident_detail(incident_id: str, db: AsyncSession = Depends(get_db), role: str = Depends(require_role(["ADMIN", "OPERATOR", "VIEWER"]))):
    inc = await db.scalar(select(Incident).where(Incident.id == uuid.UUID(incident_id)))
    if not inc:
        raise HTTPException(404, detail="Incident not found")
    agent = await db.scalar(select(Agent).where(Agent.id == inc.agent_id))
    team = await db.scalar(select(Team).where(Team.id == agent.team_id)) if agent else None
    agent_budget = await db.scalar(select(Budget).where((Budget.scope_type == "agent") & (Budget.scope_id == agent.id))) if agent else None

    requests = list((await db.scalars(select(RequestLog).where(RequestLog.agent_id == agent.id).order_by(RequestLog.created_at.desc()).limit(10))).all()) if agent else []
    hourly_key = f"agent-hourly-micro:{agent.id}" if agent else None
    hourly_spend = microdollars_to_usd(int(await redis.get(hourly_key) or 0)) if hourly_key else 0.0

    return {
        "id": str(inc.id),
        "kind": inc.kind,
        "severity": str_val(inc.severity),
        "status": str_val(inc.status),
        "reviewer": inc.reviewer,
        "agent": {"slug": agent.slug, "name": agent.name, "status": str_val(agent.status), "preferred_model": agent.preferred_model} if agent else None,
        "team": {"name": team.name, "product": team.product} if team else None,
        "monthly_limit": float(agent_budget.limit_usd) if agent_budget else 0.04,
        "hourly_spend": hourly_spend,
        "percent_consumed": round((hourly_spend / float(agent_budget.limit_usd)) * 100, 1) if agent_budget and agent_budget.limit_usd else 0,
        "metadata": inc.metadata_json,
        "created_at": inc.created_at,
        "resolved_at": inc.resolved_at,
        "recent_requests": [
            {
                "id": str(r.id),
                "requested_model": r.requested_model,
                "selected_model": r.selected_model,
                "decision": str_val(r.decision),
                "actual_cost": float(r.actual_cost_usd or 0),
                "created_at": r.created_at,
            }
            for r in requests
        ],
    }


@app.post("/api/incidents/{incident_id}/acknowledge")
async def acknowledge_incident(incident_id: str, action: IncidentAction, db: AsyncSession = Depends(get_db), role: str = Depends(require_role(["ADMIN", "OPERATOR"]))):
    inc = await db.scalar(select(Incident).where(Incident.id == uuid.UUID(incident_id)))
    if not inc:
        raise HTTPException(404, detail="Incident not found")

    inc.status = "ACKNOWLEDGED"
    inc.reviewer = action.reviewer or "admin-operator"
    db.add(LedgerEvent(event_type="INCIDENT_ACKNOWLEDGED", metadata_json={"incident_id": str(inc.id), "reviewer": inc.reviewer}))
    await db.commit()
    return {"id": str(inc.id), "status": str_val(inc.status), "reviewer": inc.reviewer}


@app.post("/api/incidents/{incident_id}/resolve")
async def resolve_incident(incident_id: str, action: IncidentAction, db: AsyncSession = Depends(get_db), role: str = Depends(require_role(["ADMIN", "OPERATOR"]))):
    inc = await db.scalar(select(Incident).where(Incident.id == uuid.UUID(incident_id)))
    if not inc:
        raise HTTPException(404, detail="Incident not found")

    inc.status = "RESOLVED"
    inc.resolved_at = datetime.now(timezone.utc)
    inc.reviewer = action.reviewer or "admin-operator"

    agent = await db.scalar(select(Agent).where(Agent.id == inc.agent_id))
    if agent and str_val(agent.status) == "PAUSED":
        agent.status = "ACTIVE"
        db.add(LedgerEvent(event_type="AGENT_RESUMED", metadata_json={"agent": agent.slug, "actor": inc.reviewer}))
        await trigger_webhooks(db, "AGENT_RESUMED", {"agent": agent.slug, "reviewer": inc.reviewer})

    db.add(LedgerEvent(event_type="INCIDENT_RESOLVED", metadata_json={"incident_id": str(inc.id), "reviewer": inc.reviewer}))
    await db.commit()
    return {"id": str(inc.id), "status": str_val(inc.status), "resolved_at": inc.resolved_at}


@app.post("/api/incidents/{incident_id}/keep-paused")
async def keep_agent_paused(incident_id: str, action: IncidentAction, db: AsyncSession = Depends(get_db), role: str = Depends(require_role(["ADMIN", "OPERATOR"]))):
    inc = await db.scalar(select(Incident).where(Incident.id == uuid.UUID(incident_id)))
    if not inc:
        raise HTTPException(404, detail="Incident not found")

    agent = await db.scalar(select(Agent).where(Agent.id == inc.agent_id))
    if agent:
        agent.status = "PAUSED"
    db.add(LedgerEvent(event_type="AGENT_KEPT_PAUSED", metadata_json={"agent": agent.slug if agent else "—", "reviewer": action.reviewer or "admin-operator"}))
    await db.commit()
    return {"id": str(inc.id), "agent": agent.slug if agent else "—", "status": "PAUSED"}


@app.post("/api/incidents/{incident_id}/revoke-agent-key")
async def incident_revoke_agent_key(incident_id: str, action: IncidentAction, db: AsyncSession = Depends(get_db), role: str = Depends(require_role(["ADMIN"]))):
    inc = await db.scalar(select(Incident).where(Incident.id == uuid.UUID(incident_id)))
    if not inc:
        raise HTTPException(404, detail="Incident not found")

    agent = await db.scalar(select(Agent).where(Agent.id == inc.agent_id))
    if not agent:
        raise HTTPException(404, detail="Associated agent not found")

    agent.api_key_hash = f"REVOKED:{uuid.uuid4().hex}"
    agent.status = "PAUSED"
    db.add(LedgerEvent(event_type="AGENT_KEY_REVOKED", metadata_json={"agent": agent.slug, "incident_id": str(inc.id), "reviewer": action.reviewer or "admin-operator"}))
    await trigger_webhooks(db, "AGENT_KEY_REVOKED", {"agent": agent.slug, "incident_id": str(inc.id)})
    await db.commit()
    return {"id": str(inc.id), "agent": agent.slug, "status": "REVOKED"}


# --- WEBHOOK & NOTIFICATION APIs ---

@app.get("/api/admin/webhooks")
async def list_webhooks(db: AsyncSession = Depends(get_db), role: str = Depends(require_role(["ADMIN", "OPERATOR", "VIEWER"]))):
    webhooks = list((await db.scalars(select(Webhook).order_by(Webhook.created_at.desc()))).all())
    return [
        {
            "id": str(w.id),
            "name": w.name,
            "url": w.url,
            "enabled": w.enabled,
            "subscribed_events": w.subscribed_events,
            "has_secret": bool(w.secret),
            "created_at": w.created_at,
        }
        for w in webhooks
    ]


@app.post("/api/admin/webhooks")
async def create_webhook(payload: WebhookCreate, db: AsyncSession = Depends(get_db), role: str = Depends(require_role(["ADMIN"]))):
    validated_url = validate_webhook_url(payload.url, allow_localhost=settings.environment.lower() != "production")
    webhook = Webhook(name=payload.name, url=validated_url, enabled=payload.enabled, subscribed_events=payload.subscribed_events, secret=payload.secret)
    db.add(webhook)
    await db.flush()
    db.add(LedgerEvent(event_type="WEBHOOK_CREATED", metadata_json={"webhook_name": payload.name, "url": validated_url}))
    await db.commit()
    return {"id": str(webhook.id), "name": webhook.name, "url": webhook.url, "enabled": webhook.enabled}


@app.put("/api/admin/webhooks/{webhook_id}")
async def update_webhook(webhook_id: str, payload: WebhookUpdate, db: AsyncSession = Depends(get_db), role: str = Depends(require_role(["ADMIN"]))):
    wh = await db.scalar(select(Webhook).where(Webhook.id == uuid.UUID(webhook_id)))
    if not wh:
        raise HTTPException(404, detail="Webhook not found")

    if payload.name is not None:
        wh.name = payload.name
    if payload.url is not None:
        wh.url = validate_webhook_url(payload.url, allow_localhost=settings.environment.lower() != "production")
    if payload.enabled is not None:
        wh.enabled = payload.enabled
    if payload.subscribed_events is not None:
        wh.subscribed_events = payload.subscribed_events
    if payload.secret is not None:
        wh.secret = payload.secret

    await db.commit()
    return {"id": str(wh.id), "name": wh.name, "url": wh.url, "enabled": wh.enabled}



@app.delete("/api/admin/webhooks/{webhook_id}")
async def delete_webhook(webhook_id: str, db: AsyncSession = Depends(get_db), role: str = Depends(require_role(["ADMIN"]))):
    wh = await db.scalar(select(Webhook).where(Webhook.id == uuid.UUID(webhook_id)))
    if not wh:
        raise HTTPException(404, detail="Webhook not found")

    await db.delete(wh)
    await db.commit()
    return {"id": webhook_id, "status": "DELETED"}


@app.post("/api/admin/webhooks/{webhook_id}/test")
async def test_webhook(webhook_id: str, db: AsyncSession = Depends(get_db), role: str = Depends(require_role(["ADMIN", "OPERATOR"]))):
    wh = await db.scalar(select(Webhook).where(Webhook.id == uuid.UUID(webhook_id)))
    if not wh:
        raise HTTPException(404, detail="Webhook not found")

    test_payload = {
        "event_id": f"evt_test_{uuid.uuid4().hex[:8]}",
        "event_type": "TEST_NOTIFICATION",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data": {"message": "0xNexigent Webhook Test Event", "target": wh.name},
    }

    from .services import deliver_webhook_payload
    asyncio.create_task(deliver_webhook_payload(wh.id, wh.url, wh.secret, "TEST_NOTIFICATION", test_payload["data"]))
    return {"webhook_id": str(wh.id), "status": "TEST_DISPATCHED", "target_url": wh.url}


@app.get("/api/admin/webhooks/{webhook_id}/deliveries")
async def get_webhook_deliveries(webhook_id: str, db: AsyncSession = Depends(get_db), role: str = Depends(require_role(["ADMIN", "OPERATOR", "VIEWER"]))):
    deliveries = list(
        (await db.scalars(select(WebhookDelivery).where(WebhookDelivery.webhook_id == uuid.UUID(webhook_id)).order_by(WebhookDelivery.created_at.desc()).limit(50))).all()
    )
    return [
        {
            "id": str(d.id),
            "event_type": d.event_type,
            "payload": d.payload,
            "status_code": d.status_code,
            "success": d.success,
            "error": d.error,
            "created_at": d.created_at,
        }
        for d in deliveries
    ]


# --- STALE RESERVATION & RECOVERY APIs ---

@app.post("/api/admin/reconcile/stale")
async def trigger_stale_reconciliation(db: AsyncSession = Depends(get_db), role: str = Depends(require_role(["ADMIN", "OPERATOR"]))):
    cleaned = await cleanup_stale_reservations(db, redis)
    return {"status": "STALE_RECONCILIATION_RUN_COMPLETE", "cleaned_count": cleaned}


@app.post("/api/admin/reconcile/{request_id}")
async def reconcile_request_manually(request_id: str, actual_cost: float = Query(gt=0), db: AsyncSession = Depends(get_db), role: str = Depends(require_role(["ADMIN", "OPERATOR"]))):
    req = await db.scalar(select(RequestLog).where(RequestLog.id == uuid.UUID(request_id)))
    if not req:
        raise HTTPException(404, detail="Request not found")
    if req.reservation_status not in ["RESERVED", "RECONCILIATION_PENDING"]:
        raise HTTPException(409, detail={"code": "REQUEST_NOT_RECONCILABLE", "message": "Only unresolved reservations can be reconciled."})
    agent = await db.scalar(select(Agent).where(Agent.id == req.agent_id))
    team = await db.scalar(select(Team).where(Team.id == agent.team_id)) if agent else None
    session_scope = uuid.uuid5(agent.id, req.session_id) if agent else None
    budgets = list((await db.scalars(select(Budget).where(((Budget.scope_type == "team") & (Budget.scope_id == team.id)) | ((Budget.scope_type == "agent") & (Budget.scope_id == agent.id)) | ((Budget.scope_type == "session") & (Budget.scope_id == session_scope)) ))).all()) if agent and team else []
    estimated = Decimal(str(req.estimated_cost_usd or 0))
    actual = Decimal(str(actual_cost))
    await release_and_charge(redis, budgets, estimated, actual)
    session_record = await db.scalar(select(Session).where((Session.agent_id == agent.id) & (Session.external_id == req.session_id))) if agent else None
    if session_record:
        session_record.reserved = max(Decimal(0), Decimal(str(session_record.reserved or 0)) - estimated)
        session_record.spent = Decimal(str(session_record.spent or 0)) + actual
    req.actual_cost_usd = actual
    req.reservation_status = "COMPLETED"
    db.add(LedgerEvent(request_id=req.id, event_type="USAGE_RECONCILED", metadata_json={"manual": True, "actual_cost": float(actual)}))
    await db.commit()
    return {"id": str(req.id), "status": "COMPLETED", "actual_cost": float(actual)}


# --- ADMIN CRUD APIs ---

@app.get("/api/admin/teams")
async def admin_list_teams(db: AsyncSession = Depends(get_db), role: str = Depends(require_role(["ADMIN", "OPERATOR", "VIEWER"]))):
    teams = list((await db.scalars(select(Team))).all())
    result = []
    for t in teams:
        b = await db.scalar(select(Budget).where((Budget.scope_type == "team") & (Budget.scope_id == t.id)))
        agents = list((await db.scalars(select(Agent).where(Agent.team_id == t.id))).all())
        spent = float(b.spent_usd) if b else 0.0
        reserved = float(b.reserved_usd) if b else 0.0
        limit = float(b.limit_usd) if b else 0.10
        percent = round((spent + reserved) / limit * 100, 1) if limit else 0
        result.append(
            {
                "id": str(t.id),
                "name": t.name,
                "product": t.product,
                "limit": limit,
                "spent": spent,
                "reserved": reserved,
                "remaining": max(0.0, limit - (spent + reserved)),
                "percent": percent,
                "agent_count": len(agents),
                "agents": [{"slug": a.slug, "name": a.name, "status": str_val(a.status)} for a in agents],
            }
        )
    return result


@app.post("/api/admin/teams")
async def admin_create_team(payload: TeamCreate, db: AsyncSession = Depends(get_db), role: str = Depends(require_role(["ADMIN"]))):
    org = await db.scalar(select(Organization).limit(1))
    if not org:
        org = Organization(name="Acme Engineering")
        db.add(org)
        await db.flush()
    team = Team(organization_id=org.id, name=payload.name, product=payload.product)
    db.add(team)
    await db.flush()
    budget = Budget(scope_type="team", scope_id=team.id, limit_usd=payload.limit_usd)
    db.add(budget)
    db.add(LedgerEvent(event_type="TEAM_CREATED", metadata_json={"team": payload.name, "limit": payload.limit_usd}))
    await db.commit()
    return {"id": str(team.id), "name": team.name, "product": team.product, "limit": float(budget.limit_usd)}


@app.put("/api/admin/teams/{team_id}/budget")
async def admin_update_team_budget(team_id: str, payload: TeamUpdateBudget, db: AsyncSession = Depends(get_db), role: str = Depends(require_role(["ADMIN"]))):
    team_uuid = uuid.UUID(team_id)
    team = await db.scalar(select(Team).where(Team.id == team_uuid))
    if not team:
        raise HTTPException(404, detail="Team not found")
    budget = await db.scalar(select(Budget).where((Budget.scope_type == "team") & (Budget.scope_id == team.id)))
    if not budget:
        raise HTTPException(404, detail="Team budget not found")

    spent_and_reserved = float(budget.spent_usd) + float(budget.reserved_usd)
    if payload.limit_usd < spent_and_reserved and not payload.confirm_reduction:
        agents = list((await db.scalars(select(Agent).where(Agent.team_id == team.id))).all())
        raise HTTPException(
            400,
            detail={
                "code": "UNSAFE_BUDGET_REDUCTION",
                "message": f"Requested limit ${payload.limit_usd:.4f} is below current consumed amount ${spent_and_reserved:.4f}. Pass confirm_reduction=true to override.",
                "current_usage": spent_and_reserved,
                "affected_agents": [a.slug for a in agents],
            },
        )

    budget.limit_usd = payload.limit_usd
    db.add(LedgerEvent(event_type="TEAM_BUDGET_UPDATED", metadata_json={"team": team.name, "new_limit": payload.limit_usd}))
    await db.commit()
    await redis.delete(f"budget:{budget.id}")
    return {"team": team.name, "limit": float(budget.limit_usd), "spent": float(budget.spent_usd)}


@app.put("/api/admin/agents/{slug}/budget")
async def admin_update_agent_budget(slug: str, payload: AgentUpdateBudget, db: AsyncSession = Depends(get_db), role: str = Depends(require_role(["ADMIN"]))):
    agent = await db.scalar(select(Agent).where(Agent.slug == slug))
    if not agent:
        raise HTTPException(404, detail="Agent not found")
    budget = await db.scalar(select(Budget).where((Budget.scope_type == "agent") & (Budget.scope_id == agent.id)))
    if not budget:
        budget = Budget(scope_type="agent", scope_id=agent.id, limit_usd=payload.monthly_budget, warning_percent=80)
        db.add(budget)
    else:
        budget.limit_usd = payload.monthly_budget

    if payload.default_session_budget is not None:
        agent.default_session_budget = payload.default_session_budget

    db.add(LedgerEvent(event_type="AGENT_BUDGET_UPDATED", metadata_json={"agent": agent.slug, "new_limit": payload.monthly_budget, "session_limit": payload.default_session_budget}))
    await db.commit()
    await redis.delete(f"budget:{budget.id}")
    return {"agent": agent.slug, "monthly_budget": float(budget.limit_usd), "default_session_budget": float(agent.default_session_budget or 0)}


@app.put("/api/admin/agents/{slug}/status")
async def admin_toggle_agent_status(slug: str, status: str, db: AsyncSession = Depends(get_db), role: str = Depends(require_role(["ADMIN"]))):
    agent = await db.scalar(select(Agent).where(Agent.slug == slug))
    if not agent:
        raise HTTPException(404, detail="Agent not found")
    agent.status = status.upper()
    db.add(LedgerEvent(event_type="AGENT_STATUS_TOGGLED", metadata_json={"agent": agent.slug, "status": agent.status}))
    await db.commit()
    return {"agent": agent.slug, "status": agent.status}


@app.get("/api/admin/agents")
async def admin_list_agents(db: AsyncSession = Depends(get_db), role: str = Depends(require_role(["ADMIN", "OPERATOR", "VIEWER"]))):
    agents = list((await db.scalars(select(Agent))).all())
    result = []
    for a in agents:
        team = await db.scalar(select(Team).where(Team.id == a.team_id))
        b = await db.scalar(select(Budget).where((Budget.scope_type == "agent") & (Budget.scope_id == a.id)))
        hourly = await redis.get(f"agent-hourly-micro:{a.id}")
        result.append(
            {
                "id": str(a.id),
                "team_id": str(a.team_id),
                "team_name": team.name if team else "—",
                "slug": a.slug,
                "name": a.name,
                "status": str_val(a.status),
                "key_prefix": a.key_prefix,
                "preferred_model": a.preferred_model,
                "fallback_model": a.fallback_model,
                "monthly_budget": float(b.limit_usd) if b else 0.04,
                "spent": float(b.spent_usd) if b else 0.0,
                "reserved": float(b.reserved_usd) if b else 0.0,
                "default_session_budget": float(a.default_session_budget or 0.01),
                "warning_percent": a.warning_percent or 80,
                "hourly_burn": microdollars_to_usd(int(hourly or 0)),
            }
        )
    return result


@app.post("/api/admin/agents")
async def admin_create_agent(payload: AgentCreate, db: AsyncSession = Depends(get_db), role: str = Depends(require_role(["ADMIN"]))):
    team_uuid = uuid.UUID(payload.team_id)
    team = await db.scalar(select(Team).where(Team.id == team_uuid))
    if not team:
        raise HTTPException(404, detail="Selected team not found")
    if await db.scalar(select(Agent).where(Agent.slug == payload.slug)):
        raise HTTPException(400, detail="Agent slug already exists")

    raw_key, prefix, hashed_key = generate_agent_key(payload.slug)

    agent = Agent(
        team_id=team.id,
        slug=payload.slug,
        name=payload.name,
        api_key_hash=hashed_key,
        key_prefix=prefix,
        preferred_model=payload.preferred_model,
        fallback_model=payload.fallback_model,
        default_session_budget=payload.default_session_budget,
        warning_percent=payload.warning_percent,
        status="ACTIVE",
    )
    db.add(agent)
    await db.flush()
    budget = Budget(scope_type="agent", scope_id=agent.id, limit_usd=payload.monthly_budget, warning_percent=payload.warning_percent)
    db.add(budget)
    db.add(LedgerEvent(event_type="AGENT_CREATED", metadata_json={"agent": agent.slug, "team": team.name, "raw_key_issued": True}))
    await db.commit()
    return {
        "id": str(agent.id),
        "slug": agent.slug,
        "name": agent.name,
        "key_prefix": prefix,
        "raw_api_key": raw_key,
        "message": "Raw API key generated. Store it securely; it will not be displayed again.",
    }


@app.post("/api/admin/agents/{slug}/rotate-key")
async def admin_rotate_key(slug: str, db: AsyncSession = Depends(get_db), role: str = Depends(require_role(["ADMIN"]))):
    agent = await db.scalar(select(Agent).where(Agent.slug == slug))
    if not agent:
        raise HTTPException(404, detail="Agent not found")

    raw_key, prefix, hashed_key = generate_agent_key(agent.slug)

    agent.api_key_hash = hashed_key
    agent.key_prefix = prefix
    db.add(LedgerEvent(event_type="KEY_ROTATED", metadata_json={"agent": agent.slug, "actor": "admin"}))
    await db.commit()
    return {
        "agent": agent.slug,
        "key_prefix": prefix,
        "raw_api_key": raw_key,
        "message": "Key rotated successfully. Update your agent's Authorization header.",
    }


@app.post("/api/admin/agents/{slug}/revoke-key")
async def admin_revoke_key(slug: str, db: AsyncSession = Depends(get_db), role: str = Depends(require_role(["ADMIN"]))):
    agent = await db.scalar(select(Agent).where(Agent.slug == slug))
    if not agent:
        raise HTTPException(404, detail="Agent not found")

    agent.api_key_hash = f"REVOKED:{uuid.uuid4().hex}"
    agent.status = "PAUSED"
    db.add(LedgerEvent(event_type="KEY_REVOKED", metadata_json={"agent": agent.slug, "actor": "admin"}))
    await trigger_webhooks(db, "AGENT_KEY_REVOKED", {"agent": agent.slug, "actor": "admin"})
    await db.commit()
    return {"agent": agent.slug, "status": "REVOKED"}


@app.get("/api/admin/keys")
async def admin_list_keys(db: AsyncSession = Depends(get_db), role: str = Depends(require_role(["ADMIN", "OPERATOR", "VIEWER"]))):
    agents = list((await db.scalars(select(Agent))).all())
    result = []
    for a in agents:
        team = await db.scalar(select(Team).where(Team.id == a.team_id))
        is_revoked = a.api_key_hash.startswith("REVOKED:")
        result.append(
            {
                "agent_slug": a.slug,
                "agent_name": a.name,
                "team_name": team.name if team else "—",
                "key_prefix": a.key_prefix,
                "status": "REVOKED" if is_revoked else str_val(a.status),
            }
        )
    return result


@app.get("/api/admin/models")
async def admin_list_models(role: str = Depends(require_role(["ADMIN", "OPERATOR", "VIEWER"]))):
    from .services import MODEL_PRICES

    return [
        {
            "id": "openai/gpt-oss-120b",
            "name": "Groq GPT-OSS 120B",
            "role": "PREFERRED",
            "input_price_per_m": float(MODEL_PRICES["openai/gpt-oss-120b"]["input"]),
            "output_price_per_m": float(MODEL_PRICES["openai/gpt-oss-120b"]["output"]),

            "context_window": 131072,
            "speed": "Ultra High",
            "description": "Premium reasoning model for high-complexity tasks.",
        },
        {
            "id": "openai/gpt-oss-20b",
            "name": "Groq GPT-OSS 20B",
            "role": "FALLBACK",
            "input_price_per_m": float(MODEL_PRICES["openai/gpt-oss-20b"]["input"]),
            "output_price_per_m": float(MODEL_PRICES["openai/gpt-oss-20b"]["output"]),
            "context_window": 131072,
            "speed": "Hyper Fast",
            "description": "Cost-optimized economy model for budget preservation.",
        },
    ]


@app.get("/api/ledger")
async def list_ledger(db: AsyncSession = Depends(get_db), role: str = Depends(require_role(["ADMIN", "OPERATOR", "VIEWER"]))):
    events = list((await db.scalars(select(LedgerEvent).order_by(LedgerEvent.created_at.desc()).limit(100))).all())
    return [
        {
            "id": str(e.id),
            "request_id": str(e.request_id) if e.request_id else None,
            "event_type": e.event_type,
            "metadata": e.metadata_json,
            "created_at": e.created_at,
        }
        for e in events
    ]


@app.post("/api/agents/{slug}/resume")
async def resume_agent(slug: str, db: AsyncSession = Depends(get_db), role: str = Depends(require_role(["ADMIN", "OPERATOR"]))):
    agent = await db.scalar(select(Agent).where(Agent.slug == slug))
    if not agent:
        raise HTTPException(404, detail="Agent not found")
    agent.status = "ACTIVE"
    db.add(LedgerEvent(event_type="AGENT_RESUMED", metadata_json={"agent": agent.slug, "actor": "dashboard"}))
    await trigger_webhooks(db, "AGENT_RESUMED", {"agent": agent.slug, "actor": "dashboard"})
    await db.commit()
    await redis.delete(f"agent-hourly-micro:{agent.id}")
    return {"agent": slug, "status": str_val(agent.status)}


@app.get("/api/events")
async def events(role: str = Depends(require_role(["ADMIN", "OPERATOR", "VIEWER"]))):
    async def stream():
        pubsub = redis.pubsub()
        await pubsub.subscribe("nexigent:events")
        try:
            while True:
                message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=10)
                if message:
                    yield f"data: {message['data']}\n\n"
                else:
                    yield ": keepalive\n\n"
                await asyncio.sleep(0.1)
        finally:
            await pubsub.unsubscribe("nexigent:events")
            await pubsub.close()

    return StreamingResponse(stream(), media_type="text/event-stream")
