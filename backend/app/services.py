import asyncio
import calendar
import hashlib
import hmac
import ipaddress
import json
import time
import urllib.parse
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from decimal import Decimal, ROUND_CEILING
import httpx
from fastapi import HTTPException
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .config import settings
from .models import Agent, AgentStatus, Budget, Decision, Incident, IncidentSeverity, IncidentStatus, LedgerEvent, Organization, RequestLog, Session, SessionStatus, Team, Webhook, WebhookDelivery
from .schemas import ChatCompletionRequest

# USD / million tokens
MODEL_PRICES = {
    "openai/gpt-oss-120b": {"input": Decimal("0.150"), "output": Decimal("0.600"), "context": 131072},
    "openai/gpt-oss-20b": {"input": Decimal("0.075"), "output": Decimal("0.300"), "context": 131072},
}

MODEL_CAPABILITIES = {
    "openai/gpt-oss-120b": {"tools": True, "structured_output": True, "max_context": 131072, "vision": False},
    "openai/gpt-oss-20b": {"tools": True, "structured_output": True, "max_context": 131072, "vision": False},
}

MICRODOLLARS_PER_USD = 1_000_000


def str_val(v) -> str:
    return str(v.value) if hasattr(v, "value") else str(v)


def usd_to_microdollars(usd: Decimal | float | int) -> int:
    return int((Decimal(str(usd)) * Decimal(MICRODOLLARS_PER_USD)).to_integral_value(rounding=ROUND_CEILING))


def microdollars_to_usd(microdollars: int) -> float:
    return float(Decimal(microdollars) / Decimal(MICRODOLLARS_PER_USD))


def validate_webhook_url(url: str, allow_localhost: bool = False) -> str:
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(400, detail={"code": "INVALID_WEBHOOK_URL", "message": "Webhook URL must use http or https scheme."})
    hostname = parsed.hostname
    if not hostname:
        raise HTTPException(400, detail={"code": "INVALID_WEBHOOK_URL", "message": "Invalid hostname in webhook URL."})
    
    if not allow_localhost:
        if hostname.lower() in ("localhost", "backend", "postgres", "redis", "internal"):
            raise HTTPException(400, detail={"code": "SSRF_BLOCKED", "message": "Localhost and internal hostnames are prohibited for webhooks in production."})
        try:
            ip = ipaddress.ip_address(hostname)
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast:
                raise HTTPException(400, detail={"code": "SSRF_BLOCKED", "message": "Private, loopback, and link-local IP addresses are prohibited for webhooks."})
        except ValueError:
            pass
    return url


RESERVE_LUA_INTEGER = """
local amount = tonumber(ARGV[1])
for i, key in ipairs(KEYS) do
  local limit = tonumber(redis.call('HGET', key, 'limit_micro') or '0')
  local spent = tonumber(redis.call('HGET', key, 'spent_micro') or '0')
  local reserved = tonumber(redis.call('HGET', key, 'reserved_micro') or '0')
  if spent + reserved + amount > limit then return {0, key} end
end
for i, key in ipairs(KEYS) do
  redis.call('HINCRBY', key, 'reserved_micro', amount)
end
return {1}
"""


def key_hash(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def generate_agent_key(slug: str) -> tuple[str, str, str]:
    raw_key = f"nx_ag_{slug}_{uuid.uuid4().hex[:16]}"
    prefix = f"{raw_key[:10]}...{raw_key[-4:]}"
    hashed = key_hash(raw_key)
    return raw_key, prefix, hashed


def estimate_cost(payload: ChatCompletionRequest, model: str) -> Decimal:
    chars = sum(len(str(message.content)) for message in payload.messages)
    input_tokens = max(1, (chars + 3) // 4)
    price = MODEL_PRICES[model]
    return (Decimal(input_tokens) * price["input"] + Decimal(payload.max_tokens) * price["output"]) / Decimal(1_000_000)


def check_model_capabilities(payload: ChatCompletionRequest, model: str) -> tuple[bool, str]:
    caps = MODEL_CAPABILITIES.get(model)
    if not caps:
        return False, "UNKNOWN_MODEL"
    if (payload.tools or payload.tool_choice) and not caps.get("tools"):
        return False, "TOOLS_NOT_SUPPORTED"
    if payload.response_format and not caps.get("structured_output"):
        return False, "STRUCTURED_OUTPUT_NOT_SUPPORTED"
    chars = sum(len(str(message.content)) for message in payload.messages)
    input_toks = max(1, (chars + 3) // 4)
    if (input_toks + payload.max_tokens) > caps.get("max_context", 131072):
        return False, "CONTEXT_LENGTH_EXCEEDED"
    return True, "OK"


async def agent_from_key(db: AsyncSession, api_key: str) -> Agent:
    agent = await db.scalar(select(Agent).where(Agent.api_key_hash == key_hash(api_key)))
    if not agent:
        raise HTTPException(401, detail={"code": "AUTHENTICATION_FAILED", "message": "Unknown or revoked gateway API key."})
    if str_val(agent.status) == "PAUSED":
        raise HTTPException(429, detail={"code": "AGENT_PAUSED", "message": "This agent is paused for human review."})
    return agent


async def budget_set(db: AsyncSession, redis: Redis, agent: Agent, session_id: str) -> list[Budget]:
    team = await db.scalar(select(Team).where(Team.id == agent.team_id))
    session_scope = uuid.uuid5(agent.id, session_id)
    result = await db.scalars(
        select(Budget).where(
            (Budget.scope_type == "team") & (Budget.scope_id == team.id)
            | (Budget.scope_type == "agent") & (Budget.scope_id == agent.id)
            | (Budget.scope_type == "session") & (Budget.scope_id == session_scope)
        )
    )
    budgets = list(result)

    now = datetime.now(timezone.utc)
    for b in budgets:
        if b.period == "monthly":
            if not b.period_end or now > b.period_end:
                year, month = now.year, now.month
                last_day = calendar.monthrange(year, month)[1]
                b.period_start = datetime(year, month, 1, 0, 0, 0, tzinfo=timezone.utc)
                b.period_end = datetime(year, month, last_day, 23, 59, 59, tzinfo=timezone.utc)
                b.spent_usd = Decimal(0)
                b.reserved_usd = Decimal(0)
                b.warning_sent = False
                await redis.delete(f"budget:{b.id}")
                db.add(LedgerEvent(event_type="BUDGET_PERIOD_RESET", metadata_json={"budget_id": str(b.id), "scope": b.scope_type}))

    if not any(b.scope_type == "session" for b in budgets):
        default_limit = Decimal(str(agent.default_session_budget or 0.01))
        session_budget = Budget(scope_type="session", scope_id=session_scope, period="session", limit_usd=default_limit)
        db.add(session_budget)
        await db.flush()
        budgets.append(session_budget)
        db.add(LedgerEvent(event_type="SESSION_CREATED", metadata_json={"agent": agent.slug, "session_id": session_id, "limit": float(default_limit)}))

    session_record = await db.scalar(
        select(Session).where((Session.agent_id == agent.id) & (Session.external_id == session_id))
    )
    if not session_record:
        default_limit = Decimal(str(agent.default_session_budget or 0.01))
        session_record = Session(agent_id=agent.id, external_id=session_id, budget_limit=default_limit, status="ACTIVE")
        db.add(session_record)
        await db.flush()
    elif str_val(session_record.status) == "EXHAUSTED":
        raise HTTPException(429, detail={"code": "SESSION_BUDGET_EXHAUSTED", "message": "This session's budget has been fully consumed."})
    elif str_val(session_record.status) == "CLOSED":
        raise HTTPException(400, detail={"code": "SESSION_CLOSED", "message": "This session has been closed. Only a new session ID can begin a new session."})

    return budgets


async def ensure_redis_budget(redis: Redis, budget: Budget) -> str:
    key = f"budget:{budget.id}"
    limit_micro = usd_to_microdollars(budget.limit_usd)
    spent_micro = usd_to_microdollars(budget.spent_usd)
    reserved_micro = usd_to_microdollars(budget.reserved_usd)
    await redis.hsetnx(key, "limit_micro", str(limit_micro))
    await redis.hsetnx(key, "spent_micro", str(spent_micro))
    await redis.hsetnx(key, "reserved_micro", str(reserved_micro))
    return key


async def reserve(redis: Redis, budgets: list[Budget], amount: Decimal) -> bool:
    keys = [await ensure_redis_budget(redis, budget) for budget in budgets]
    amount_micro = usd_to_microdollars(amount)
    result = await redis.eval(RESERVE_LUA_INTEGER, len(keys), *keys, str(amount_micro))
    success = bool(result and int(result[0]) == 1)
    if success:
        for budget in budgets:
            budget.reserved_usd = Decimal(str(budget.reserved_usd)) + amount
    return success


async def release_and_charge(redis: Redis, budgets: list[Budget], reserved: Decimal, actual: Decimal) -> None:
    reserved_micro = usd_to_microdollars(reserved)
    actual_micro = usd_to_microdollars(actual)
    for budget in budgets:
        key = await ensure_redis_budget(redis, budget)
        await redis.hincrby(key, "reserved_micro", -reserved_micro)
        await redis.hincrby(key, "spent_micro", actual_micro)
        budget.reserved_usd = max(Decimal(0), Decimal(str(budget.reserved_usd)) - reserved)
        budget.spent_usd = Decimal(str(budget.spent_usd)) + actual


async def emit(redis: Redis, name: str, data: dict) -> None:
    await redis.publish("nexigent:events", json.dumps({"event": name, "data": data}))


async def trigger_webhooks(db: AsyncSession, event_type: str, payload_data: dict) -> None:
    result = await db.scalars(select(Webhook).where(Webhook.enabled == True))
    webhooks = list(result)
    if not webhooks:
        return

    for wh in webhooks:
        subscribed = wh.subscribed_events or []
        if "*" not in subscribed and event_type not in subscribed:
            continue
        asyncio.create_task(deliver_webhook_payload(wh.id, wh.url, wh.secret, event_type, payload_data))


async def deliver_webhook_payload(webhook_id: uuid.UUID, url: str, secret: str | None, event_type: str, data: dict) -> None:
    payload = {
        "event_id": f"evt_{uuid.uuid4().hex[:12]}",
        "event_type": event_type,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data": data,
    }
    body_bytes = json.dumps(payload).encode("utf-8")
    headers = {"Content-Type": "application/json", "X-Nexigent-Event": event_type}

    if secret:
        signature = hmac.new(secret.encode("utf-8"), body_bytes, hashlib.sha256).hexdigest()
        headers["X-Nexigent-Signature"] = f"sha256={signature}"

    success = False
    status_code = None
    error_msg = None

    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                res = await client.post(url, headers=headers, content=body_bytes)
                status_code = res.status_code
                if res.status_code < 400:
                    success = True
                    break
                else:
                    error_msg = f"HTTP {res.status_code}: {res.text[:200]}"
        except Exception as exc:
            error_msg = str(exc)
        await asyncio.sleep(0.2 * (2**attempt))

    try:
        from .database import SessionLocal
        async with SessionLocal() as db:
            delivery = WebhookDelivery(
                webhook_id=webhook_id,
                event_type=event_type,
                payload=payload,
                status_code=status_code,
                success=success,
                error=error_msg,
            )
            db.add(delivery)
            await db.commit()
    except Exception:
        pass


async def check_thresholds(db: AsyncSession, redis: Redis, budgets: list[Budget], request_id: uuid.UUID, agent: Agent, team: Team) -> list[dict]:
    warnings = []
    for budget in budgets:
        spent = Decimal(str(budget.spent_usd))
        ratio = (spent / Decimal(str(budget.limit_usd))) * 100 if budget.limit_usd else Decimal(0)
        if ratio >= budget.warning_percent and not budget.warning_sent:
            budget.warning_sent = True
            db.add(LedgerEvent(request_id=request_id, event_type="BUDGET_WARNING", metadata_json={"budget_id": str(budget.id), "scope": budget.scope_type, "percent": float(ratio)}))
            await emit(redis, "budget.warning", {"budget_id": str(budget.id), "percent": float(ratio)})
            await trigger_webhooks(db, "BUDGET_WARNING", {
                "team": team.name if team else "—",
                "agent": agent.slug,
                "scope": budget.scope_type,
                "percent": float(ratio),
                "request_id": str(request_id),
            })
            warnings.append({"scope": budget.scope_type, "percent": float(ratio)})
    return warnings


async def call_groq(payload: ChatCompletionRequest, selected_model: str) -> dict:
    if not settings.groq_api_key:
        raise HTTPException(503, detail={"code": "GROQ_NOT_CONFIGURED", "message": "GROQ_API_KEY is required; no mock provider is available."})
    body = {
        "model": selected_model,
        "messages": [message.model_dump() for message in payload.messages],
        "max_tokens": payload.max_tokens,
        "stream": False,
    }
    if payload.tools:
        body["tools"] = payload.tools
    if payload.tool_choice:
        body["tool_choice"] = payload.tool_choice
    if payload.response_format:
        body["response_format"] = payload.response_format

    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(
            f"{settings.groq_base_url.rstrip('/')}/chat/completions",
            headers={"Authorization": f"Bearer {settings.groq_api_key}"},
            json=body,
        )
    if response.status_code >= 400:
        raise HTTPException(response.status_code, detail={"code": "PROVIDER_ERROR", "message": response.text[:500]})
    return response.json()


async def cleanup_stale_reservations(db: AsyncSession, redis: Redis) -> int:
    """Fail closed on an uncertain provider outcome; do not release a potentially billed hold."""
    cutoff = datetime.now(timezone.utc)
    stale_requests = list((await db.scalars(select(RequestLog).where(RequestLog.reservation_status == "RESERVED"))).all())
    marked_count = 0
    for req in stale_requests:
        age = (cutoff - req.created_at).total_seconds() if req.created_at else 100
        if age > 60:
            req.reservation_status = "RECONCILIATION_PENDING"
            db.add(LedgerEvent(request_id=req.id, event_type="RECONCILIATION_PENDING", metadata_json={"reason": "STALE_PROVIDER_OUTCOME", "age_seconds": age}))
            marked_count += 1
    if marked_count:
        await db.commit()
    return marked_count


async def execute(db: AsyncSession, redis: Redis, agent: Agent, payload: ChatCompletionRequest, idempotency_key: str | None = None) -> tuple[dict, Decision, str, uuid.UUID, float, float, list[dict]]:
    if str_val(agent.status) == "PAUSED":
        raise HTTPException(429, detail={"code": "AGENT_PAUSED", "message": "This agent is paused for human review."})
    if not settings.groq_api_key:
        raise HTTPException(503, detail={"code": "GROQ_NOT_CONFIGURED", "message": "GROQ_API_KEY is required; no mock provider is available."})
    if payload.stream:
        raise HTTPException(400, detail={"code": "STREAMING_NOT_YET_SUPPORTED", "message": "Use non-streaming calls for the initial runtime controller."})

    team = await db.scalar(select(Team).where(Team.id == agent.team_id))
    budgets = await budget_set(db, redis, agent, payload.session_id)
    session_record = await db.scalar(select(Session).where((Session.agent_id == agent.id) & (Session.external_id == payload.session_id)))
    candidates = [payload.model]
    if agent.fallback_model and agent.fallback_model not in candidates:
        candidates.append(agent.fallback_model)

    selected = None
    reserved = Decimal(0)
    decision = Decision.allow
    rejected_capabilities: list[str] = []
    for index, candidate in enumerate(candidates):
        if candidate not in MODEL_PRICES:
            rejected_capabilities.append("UNKNOWN_MODEL")
            continue
        capable, cap_reason = check_model_capabilities(payload, candidate)
        if not capable:
            rejected_capabilities.append(cap_reason)
            continue
        cost = estimate_cost(payload, candidate)
        if await reserve(redis, budgets, cost):
            selected, reserved = candidate, cost
            decision = Decision.allow if index == 0 else Decision.reroute
            break

    request = RequestLog(
        agent_id=agent.id,
        session_id=payload.session_id,
        requested_model=payload.model,
        selected_model=selected,
        decision=str_val(decision if selected else Decision.block),
        estimated_cost_usd=reserved if selected else Decimal(0),
        reason="BUDGET_PRESSURE" if decision == Decision.reroute else None,
        idempotency_key=idempotency_key,
        reservation_status="RESERVED" if selected else "BLOCKED",
    )

    if not selected:
        session_budget = next((b for b in budgets if b.scope_type == "session"), None)
        session_consumed = Decimal(str(session_budget.spent_usd)) + Decimal(str(session_budget.reserved_usd)) if session_budget else Decimal(0)
        is_session_exhausted = bool(session_budget and session_consumed >= Decimal(str(session_budget.limit_usd)))
        if is_session_exhausted:
            error_code, error_message = "SESSION_BUDGET_EXHAUSTED", "This session's budget has been fully consumed."
        elif rejected_capabilities and len(rejected_capabilities) == len(candidates):
            error_code, error_message = "CAPABILITY_MISMATCH", "No approved Groq model supports this request's required capabilities."
        else:
            error_code, error_message = "BUDGET_EXHAUSTED", "No approved Groq model can fit all active budgets."
        request.reason = error_code
        db.add(request)
        await db.flush()
        if is_session_exhausted and session_record:
            session_record.status = "EXHAUSTED"
            session_record.closed_at = datetime.now(timezone.utc)
            db.add(LedgerEvent(request_id=request.id, event_type="SESSION_EXHAUSTED", metadata_json={"agent": agent.slug, "session_id": payload.session_id}))
            await trigger_webhooks(db, "BUDGET_EXHAUSTED", {"agent": agent.slug, "session_id": payload.session_id, "request_id": str(request.id)})
        db.add(LedgerEvent(request_id=request.id, event_type="REQUEST_BLOCKED", metadata_json={"agent": agent.slug, "reason": error_code}))
        await db.commit()
        await emit(redis, "request.blocked", {"agent": agent.slug, "reason": error_code})
        raise HTTPException(429, detail={"code": error_code, "message": error_message, "request_id": str(request.id)})

    if session_record:
        session_record.reserved = Decimal(str(session_record.reserved or 0)) + reserved
    db.add(request)
    await db.flush()
    db.add(LedgerEvent(request_id=request.id, event_type="RECEIVED", metadata_json={"agent": agent.slug, "requested_model": payload.model}))
    db.add(LedgerEvent(request_id=request.id, event_type="RESERVED", metadata_json={"amount": float(reserved), "model": selected}))
    if decision == Decision.reroute:
        db.add(LedgerEvent(request_id=request.id, event_type="MODEL_REROUTED", metadata_json={"requested": payload.model, "selected": selected}))
        await trigger_webhooks(db, "MODEL_REROUTED", {"agent": agent.slug, "requested": payload.model, "selected": selected, "request_id": str(request.id)})
    await db.flush()

    try:
        response = await call_groq(payload, selected)
        db.add(LedgerEvent(request_id=request.id, event_type="GROQ_EXECUTED", metadata_json={"provider_id": response.get("id"), "model": selected}))
    except Exception:
        request.reservation_status = "RECONCILIATION_PENDING"
        db.add(LedgerEvent(request_id=request.id, event_type="RECONCILIATION_PENDING", metadata_json={"reason": "GROQ_CALL_FAILED"}))
        await db.commit()
        raise

    usage = response.get("usage", {})
    price = MODEL_PRICES[selected]
    input_toks = usage.get("prompt_tokens", 0)
    output_toks = usage.get("completion_tokens", 0)
    reasoning_toks = usage.get("completion_tokens_details", {}).get("reasoning_tokens", 0)
    actual = (Decimal(input_toks) * price["input"] + Decimal(output_toks) * price["output"]) / Decimal(1_000_000)
    await release_and_charge(redis, budgets, reserved, actual)

    request.actual_cost_usd = actual
    request.input_tokens = input_toks
    request.output_tokens = output_toks
    request.reasoning_tokens = reasoning_toks
    request.provider_request_id = response.get("id")
    request.reservation_status = "COMPLETED"
    db.add(LedgerEvent(request_id=request.id, event_type="USAGE_RECONCILED", metadata_json={"actual_cost": float(actual), "model": selected, "input_tokens": input_toks, "output_tokens": output_toks}))
    if session_record:
        session_record.reserved = max(Decimal(0), Decimal(str(session_record.reserved or 0)) - reserved)
        session_record.spent = Decimal(str(session_record.spent or 0)) + actual

        session_budget = next((b for b in budgets if b.scope_type == "session"), None)
        if session_budget:
            session_consumed = Decimal(str(session_budget.spent_usd)) + Decimal(str(session_budget.reserved_usd))
            if session_consumed >= Decimal(str(session_budget.limit_usd)) and str_val(session_record.status) != "EXHAUSTED":
                session_record.status = "EXHAUSTED"
                session_record.closed_at = datetime.now(timezone.utc)
                db.add(LedgerEvent(request_id=request.id, event_type="SESSION_EXHAUSTED", metadata_json={"agent": agent.slug, "session_id": payload.session_id}))
                await trigger_webhooks(db, "BUDGET_EXHAUSTED", {"agent": agent.slug, "session_id": payload.session_id, "request_id": str(request.id)})

    agent_budget = next(b for b in budgets if b.scope_type == "agent")
    hourly_key = f"agent-hourly-micro:{agent.id}"
    hourly_micro = await redis.incrby(hourly_key, usd_to_microdollars(actual))
    await redis.expire(hourly_key, 3600)
    hourly = microdollars_to_usd(hourly_micro)
    if hourly_micro > usd_to_microdollars(Decimal(str(agent_budget.limit_usd)) * Decimal("0.20")):
        agent.status = "PAUSED"
        db.add(Incident(agent_id=agent.id, team_id=team.id if team else None, kind="RUNAWAY_AGENT", severity="CRITICAL", status="OPEN", metadata_json={"hourly_spend": hourly, "monthly_limit": float(agent_budget.limit_usd), "request_id": str(request.id)}))
        db.add(LedgerEvent(request_id=request.id, event_type="RUNAWAY_AGENT_PAUSED", metadata_json={"hourly_spend": hourly}))
        await emit(redis, "agent.paused", {"agent": agent.slug, "reason": "RUNAWAY_AGENT"})
        await trigger_webhooks(db, "RUNAWAY_AGENT_PAUSED", {"agent": agent.slug, "hourly_spend": hourly, "request_id": str(request.id)})

    warnings = await check_thresholds(db, redis, budgets, request.id, agent, team)
    await db.commit()
    await emit(redis, "request.completed", {"agent": agent.slug, "decision": str_val(decision), "actual_cost": float(actual)})
    return response, decision, selected, request.id, float(reserved), float(actual), warnings
