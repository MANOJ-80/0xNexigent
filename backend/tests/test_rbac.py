import pytest
import httpx
from app.auth import create_access_token

BASE_URL = "http://localhost:8000"

@pytest.mark.asyncio
async def test_unauthenticated_rejection():
    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        # Operational routes should reject unauthenticated users
        r = await client.get("/api/overview")
        assert r.status_code == 401
        
        r = await client.get("/api/sessions")
        assert r.status_code == 401
        
        r = await client.post("/api/sessions/test-session/close")
        assert r.status_code == 401
        
        r = await client.get("/api/incidents")
        assert r.status_code == 401
        
        r = await client.get("/api/ledger")
        assert r.status_code == 401

@pytest.mark.asyncio
async def test_role_based_write_restrictions():
    viewer_token = create_access_token({"sub": "test-viewer", "role": "VIEWER"})
    headers = {"Authorization": f"Bearer {viewer_token}"}
    
    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        # Read-only should work
        r = await client.get("/api/overview", headers=headers)
        assert r.status_code == 200
        
        # Mutations should be rejected (403 Forbidden)
        r = await client.post("/api/sessions/test-session/close", headers=headers)
        assert r.status_code == 403
        
        r = await client.post("/api/incidents/test-incident/acknowledge", json={"reviewer": "test"}, headers=headers)
        assert r.status_code == 403

        r = await client.put("/api/sessions/test-session/budget", json={"limit_usd": 1, "agent_slug": "test"}, headers=headers)
        assert r.status_code == 403
