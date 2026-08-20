"""A real agent call through 0xNexigent; it never calls Groq directly."""
import os

import httpx

gateway_url = os.getenv("NEXIGENT_BASE_URL", "http://localhost:8000")
agent_key = os.getenv("NEXIGENT_AGENT_API_KEY", "nx_demo_research-agent")

payload = {
    "model": "openai/gpt-oss-120b",
    "session_id": "external-research-demo",
    "max_tokens": 120,
    "messages": [{"role": "user", "content": "In one sentence, explain why LLM budget enforcement should happen before execution."}],
}

response = httpx.post(f"{gateway_url}/v1/chat/completions", headers={"Authorization": f"Bearer {agent_key}"}, json=payload, timeout=60)
response.raise_for_status()
print("decision:", response.headers["X-Nexigent-Decision"])
print("model:", response.headers["X-Nexigent-Model"])
print(response.json()["choices"][0]["message"]["content"])
