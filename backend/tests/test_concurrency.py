import asyncio
import httpx
import pytest

import os
from app.auth import create_access_token

BASE_URL = os.getenv("TEST_BASE_URL", "http://localhost:8000")

admin_token = create_access_token({"sub": "admin", "role": "ADMIN"})
ADMIN_HEADERS = {"Authorization": f"Bearer {admin_token}"}


@pytest.mark.asyncio
async def test_health():
    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        r = await client.get("/health")
        assert r.status_code == 200
        assert r.json()["status"] == "healthy"


@pytest.mark.asyncio
async def test_admin_auth_enforcement():
    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        # Without auth header -> 401
        r1 = await client.get("/api/admin/teams")
        assert r1.status_code == 401
        assert r1.json()["detail"]["code"] == "AUTHENTICATION_FAILED"

        # With agent key -> 403
        r2 = await client.get("/api/admin/teams", headers={"Authorization": "Bearer nx_demo_research-agent"})
        assert r2.status_code == 403
        assert r2.json()["detail"]["code"] == "FORBIDDEN"

        # With valid admin key -> 200
        r3 = await client.get("/api/admin/teams", headers=ADMIN_HEADERS)
        assert r3.status_code == 200


@pytest.mark.asyncio
async def test_normal_allow():
    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        r = await client.post(
            "/api/demo/run",
            json={"agent_slug": "research-agent", "session_id": "test-allow-session", "prompt": "Say hello in 3 words.", "max_tokens": 30},
            headers=ADMIN_HEADERS
        )
        assert r.status_code == 200
        data = r.json()
        assert data["decision"] == "ALLOW"
        assert "gpt-oss-120b" in data["model"]


@pytest.mark.asyncio
async def test_reroute_scenario():
    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        r = await client.post("/api/demo/scenarios/reroute", headers=ADMIN_HEADERS)
        assert r.status_code == 200
        data = r.json()
        assert data["decision"] == "REROUTE"
        assert "20b" in data["model"]

        req_id = data["request_id"]
        detail_res = await client.get(f"/api/requests/{req_id}", headers=ADMIN_HEADERS)
        assert detail_res.status_code == 200
        detail = detail_res.json()
        assert detail["requested_model"] == "openai/gpt-oss-120b"
        assert detail["selected_model"] == "openai/gpt-oss-20b"
        assert detail["decision"] == "REROUTE"
        events = detail["ledger_events"]
        assert any(e["event_type"] == "MODEL_REROUTED" for e in events)


@pytest.mark.asyncio
async def test_block_scenario():
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30) as client:
        r = await client.post("/api/demo/scenarios/block", headers=ADMIN_HEADERS)
        assert r.status_code == 429
        data = r.json()
        assert data["detail"]["code"] in ["BUDGET_EXHAUSTED", "SESSION_BUDGET_EXHAUSTED"]


@pytest.mark.asyncio
async def test_warning_scenario():
    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        r = await client.post("/api/demo/scenarios/warning", headers=ADMIN_HEADERS)
        assert r.status_code == 200
        data = r.json()
        assert data["decision"] in ["ALLOW", "REROUTE"]
        
        req_id = data["request_id"]
        detail_res = await client.get(f"/api/requests/{req_id}", headers=ADMIN_HEADERS)
        assert detail_res.status_code == 200
        detail = detail_res.json()
        events = detail["ledger_events"]
        assert any(e["event_type"] == "BUDGET_WARNING" and e["metadata"].get("percent", 0) >= 80 for e in events)


@pytest.mark.asyncio
async def test_runaway_and_resume():
    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        r1 = await client.post("/api/demo/scenarios/runaway", headers=ADMIN_HEADERS)
        assert r1.status_code in [200, 429]
        
        incidents_r = await client.get("/api/incidents", headers=ADMIN_HEADERS)
        incidents = incidents_r.json()
        assert any(i["kind"] == "RUNAWAY_AGENT" and i["agent_slug"] == "loop-agent" for i in incidents)
        
        agents_r = await client.get("/api/admin/agents", headers=ADMIN_HEADERS)
        loop_agent = next(a for a in agents_r.json() if a["slug"] == "loop-agent")
        assert loop_agent["status"] == "PAUSED"
        
        r_gw = await client.post(
            "/v1/chat/completions",
            headers={"Authorization": "Bearer nx_demo_loop-agent"},
            json={"model": "openai/gpt-oss-120b", "session_id": "loop-test", "max_tokens": 10, "messages": [{"role": "user", "content": "Hi"}]},
        )
        assert r_gw.status_code == 429
        assert r_gw.json()["detail"]["code"] == "AGENT_PAUSED"

        r2 = await client.post("/api/agents/loop-agent/resume", headers=ADMIN_HEADERS)
        assert r2.status_code == 200
        assert r2.json()["status"] == "ACTIVE"


@pytest.mark.asyncio
async def test_closed_session_rejection():
    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        sess_id = f"test-close-reject-session-{asyncio.get_event_loop().time()}"

        # Run a request to initialize session
        r1 = await client.post(
            "/v1/chat/completions",
            headers={"Authorization": "Bearer nx_demo_research-agent"},
            json={"model": "openai/gpt-oss-120b", "session_id": sess_id, "max_tokens": 10, "messages": [{"role": "user", "content": "Hi"}]},
        )
        assert r1.status_code in [200, 429]

        # Explicitly close the session
        close_r = await client.post(f"/api/sessions/{sess_id}/close", headers=ADMIN_HEADERS)
        assert close_r.status_code == 200

        # Attempt another request on the CLOSED session -> must be rejected 400
        r2 = await client.post(
            "/v1/chat/completions",
            headers={"Authorization": "Bearer nx_demo_research-agent"},
            json={"model": "openai/gpt-oss-120b", "session_id": sess_id, "max_tokens": 10, "messages": [{"role": "user", "content": "Hi again"}]},
        )
        assert r2.status_code == 400
        assert r2.json()["detail"]["code"] == "SESSION_CLOSED"


@pytest.mark.asyncio
async def test_concurrent_budget_invariant():
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30) as client:
        await client.post("/api/demo/reset", headers=ADMIN_HEADERS)
        preset_r = await client.post("/api/demo/scenarios/reroute", headers=ADMIN_HEADERS)
        assert preset_r.status_code == 200

        async def make_request(idx: int):
            return await client.post(
                "/v1/chat/completions",
                headers={"Authorization": "Bearer nx_demo_support-agent"},
                json={
                    "model": "openai/gpt-oss-120b",
                    "session_id": "reroute-real",
                    "max_tokens": 40,
                    "messages": [{"role": "user", "content": f"Parallel stress ping {idx}"}],
                },
            )

        responses = await asyncio.gather(*[make_request(i) for i in range(10)])
        statuses = [r.status_code for r in responses]
        allowed_count = sum(1 for s in statuses if s == 200)
        blocked_count = sum(1 for s in statuses if s == 429)
        assert allowed_count > 0, "At least one request should be allowed"
        assert blocked_count > 0, "Over-budget concurrent requests must be blocked"
        assert allowed_count + blocked_count == 10, "All requests should be either allowed or blocked"

        overview_r = await client.get("/api/overview", headers=ADMIN_HEADERS)
        agents_r = await client.get("/api/admin/agents", headers=ADMIN_HEADERS)
        assert agents_r.status_code == 200
        support = next(agent for agent in agents_r.json() if agent["slug"] == "support-agent")
        assert support["spent"] + support["reserved"] <= support["monthly_budget"], (
            "Atomic reservations must preserve the agent budget invariant"
        )
        assert overview_r.status_code == 200


@pytest.mark.asyncio
async def test_session_exhaustion_by_actual_usage():
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30) as client:
        sess_id = f"test-exhaust-session-{asyncio.get_event_loop().time()}"
        
        await client.put(f"/api/sessions/{sess_id}/budget", json={"limit_usd": 0.0000009, "agent_slug": "research-agent"}, headers=ADMIN_HEADERS)
        
        r1 = await client.post(
            "/v1/chat/completions",
            headers={"Authorization": "Bearer nx_demo_research-agent"},
            json={"model": "openai/gpt-oss-120b", "session_id": sess_id, "max_tokens": 1, "messages": [{"role": "user", "content": "Hi"}]},
        )
        assert r1.status_code == 200
        
        sess_r = await client.get(f"/api/sessions/{sess_id}", headers=ADMIN_HEADERS)
        assert sess_r.json()["status"] == "EXHAUSTED"
        
        r2 = await client.post(
            "/v1/chat/completions",
            headers={"Authorization": "Bearer nx_demo_research-agent"},
            json={"model": "openai/gpt-oss-120b", "session_id": sess_id, "max_tokens": 10, "messages": [{"role": "user", "content": "Hi again"}]},
        )
        assert r2.status_code == 429
        assert r2.json()["detail"]["code"] == "SESSION_BUDGET_EXHAUSTED"


@pytest.mark.asyncio
async def test_three_agents_concurrent():
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30) as client:
        await client.post("/api/demo/reset", headers=ADMIN_HEADERS)
        
        # 1. Create a low-budget team
        # We set the limit to 0.000025 (25 microdollars).
        # A request with max_tokens=60 for 20b costs ~18 microdollars.
        # This allows 1 request (18 <= 25), but blocks the 2nd (36 > 25).
        team_res = await client.post("/api/admin/teams", json={"name": "Low Budget Team", "product": "Core", "limit_usd": 0.000025}, headers=ADMIN_HEADERS)
        assert team_res.status_code == 200
        team_id = team_res.json()["id"]

        # 2. Create 3 agents under this team
        agents_info = {}
        for i in range(3):
            slug = f"test-ag-{i}"
            res = await client.post("/api/admin/agents", json={
                "team_id": team_id,
                "name": f"Agent {i}",
                "slug": slug,
                "monthly_budget": 0.1,  # Large enough so it's not the bottleneck
                "default_session_budget": 0.1
            }, headers=ADMIN_HEADERS)
            assert res.status_code == 200
            agents_info[slug] = res.json()["raw_api_key"]

        # 3. Fire concurrent requests from all 3 agents
        async def make_request(slug, raw_key):
            return await client.post(
                "/v1/chat/completions",
                headers={"Authorization": f"Bearer {raw_key}"},
                json={
                    "model": "openai/gpt-oss-120b",
                    "session_id": f"sess-{slug}",
                    "max_tokens": 60,
                    "messages": [{"role": "user", "content": "Ping"}],
                },
            )
            
        tasks = [make_request(slug, key) for slug, key in agents_info.items()]
        responses = await asyncio.gather(*tasks)
        
        # 4. Check results
        statuses = [r.status_code for r in responses]
        allowed = sum(1 for s in statuses if s == 200)
        blocked = sum(1 for s in statuses if s == 429)
        
        assert allowed > 0, "At least one request should have succeeded"
        assert blocked > 0, "At least one request should have been blocked due to shared team limit"
        
        # Assert budget invariants
        agents_r = await client.get("/api/admin/agents", headers=ADMIN_HEADERS)
        assert agents_r.status_code == 200
        agents_data = agents_r.json()
        
        for slug in agents_info:
            agent_data = next(a for a in agents_data if a["slug"] == slug)
            assert agent_data["spent"] + agent_data["reserved"] <= agent_data["monthly_budget"]
        
        # The team's spent + reserved must not exceed the team limit
        teams_r = await client.get("/api/admin/teams", headers=ADMIN_HEADERS)
        assert teams_r.status_code == 200
        team_data = next(t for t in teams_r.json() if t["id"] == team_id)
        assert team_data["spent"] + team_data["reserved"] <= team_data["limit"]


@pytest.mark.asyncio
async def test_request_detail_audit():
    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        run_res = await client.post(
            "/api/demo/run",
            json={"agent_slug": "research-agent", "session_id": "audit-test-session", "prompt": "Testing audit endpoint.", "max_tokens": 20},
            headers=ADMIN_HEADERS
        )
        assert run_res.status_code == 200
        req_id = run_res.json()["request_id"]
        detail_res = await client.get(f"/api/requests/{req_id}", headers=ADMIN_HEADERS)
        assert detail_res.status_code == 200
        detail = detail_res.json()
        assert detail["id"] == req_id
        assert len(detail["ledger_events"]) > 0

@pytest.mark.asyncio
async def test_ledger_endpoint():
    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        r = await client.get("/api/ledger", headers=ADMIN_HEADERS)
        assert r.status_code == 200
        events = r.json()
        assert isinstance(events, list)


@pytest.mark.asyncio
async def test_incidents_endpoint():
    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        r = await client.get("/api/incidents", headers=ADMIN_HEADERS)
        assert r.status_code == 200
        incidents = r.json()
        assert isinstance(incidents, list)


@pytest.mark.asyncio
async def test_admin_team_and_agent_provisioning():
    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        # Create Team
        team_res = await client.post(
            "/api/admin/teams",
            headers=ADMIN_HEADERS,
            json={"name": "Integration Test Team", "product": "Testing Engine", "limit_usd": 0.20},
        )
        assert team_res.status_code == 200
        team = team_res.json()
        team_id = team["id"]

        # Provision Agent
        agent_res = await client.post(
            "/api/admin/agents",
            headers=ADMIN_HEADERS,
            json={
                "team_id": team_id,
                "name": "Integration Agent",
                "slug": f"test-agent-{asyncio.get_event_loop().time()}",
                "preferred_model": "openai/gpt-oss-120b",
                "fallback_model": "openai/gpt-oss-20b",
                "monthly_budget": 0.05,
                "default_session_budget": 0.01,
                "warning_percent": 80,
            },
        )
        assert agent_res.status_code == 200
        agent = agent_res.json()
        raw_key = agent["raw_api_key"]
        assert raw_key.startswith("nx_ag_")

        # Execute Request with Issued Key
        chat_res = await client.post(
            "/v1/chat/completions",
            headers={"Authorization": f"Bearer {raw_key}"},
            json={"model": "openai/gpt-oss-120b", "session_id": "test-issued-session", "max_tokens": 20, "messages": [{"role": "user", "content": "Ping"}]},
        )
        assert chat_res.status_code == 200
        assert chat_res.headers.get("X-Nexigent-Decision") == "ALLOW"


@pytest.mark.asyncio
async def test_idempotency_key_header():
    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        key = f"idem-key-{asyncio.get_event_loop().time()}"
        headers = {"Authorization": "Bearer nx_demo_research-agent", "Idempotency-Key": key}
        payload = {
            "model": "openai/gpt-oss-120b",
            "session_id": "test-idempotency-session",
            "max_tokens": 20,
            "messages": [{"role": "user", "content": "Idempotent Ping"}],
        }

        r1 = await client.post("/v1/chat/completions", headers=headers, json=payload)
        assert r1.status_code == 200
        assert "X-Cache" not in r1.headers

        r2 = await client.post("/v1/chat/completions", headers=headers, json=payload)
        assert r2.status_code == 200
        assert r2.headers.get("X-Cache") == "HIT"


@pytest.mark.asyncio
async def test_unsafe_budget_reduction_safeguard():
    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        teams_res = await client.get("/api/admin/teams", headers=ADMIN_HEADERS)
        assert teams_res.status_code == 200
        teams = teams_res.json()
        team_with_spend = next((t for t in teams if t["spent"] > 0), teams[0])

        too_low = max(0.00001, team_with_spend["spent"] / 2)
        r = await client.put(
            f"/api/admin/teams/{team_with_spend['id']}/budget",
            headers=ADMIN_HEADERS,
            json={"limit_usd": too_low, "confirm_reduction": False},
        )
        assert r.status_code == 400
        assert r.json()["detail"]["code"] == "UNSAFE_BUDGET_REDUCTION"


@pytest.mark.asyncio
async def test_webhook_url_validation():
    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        # Invalid protocol -> 400
        r1 = await client.post(
            "/api/admin/webhooks",
            headers=ADMIN_HEADERS,
            json={"name": "Bad Protocol", "url": "ftp://example.com/webhook", "enabled": True},
        )
        assert r1.status_code == 400
        assert r1.json()["detail"]["code"] == "INVALID_WEBHOOK_URL"
