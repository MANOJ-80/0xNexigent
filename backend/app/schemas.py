import uuid
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: str
    content: Any


class ChatCompletionRequest(BaseModel):
    model: str
    messages: List[ChatMessage]
    session_id: str = Field(default="default-session")
    max_tokens: int = Field(default=120)
    stream: bool = Field(default=False)
    tools: Optional[List[Any]] = None
    tool_choice: Optional[Any] = None
    response_format: Optional[Dict[str, Any]] = None


class DemoRunRequest(BaseModel):
    agent_slug: str
    prompt: str
    session_id: str = Field(default="demo-session")
    max_tokens: int = Field(default=120)


class TeamCreate(BaseModel):
    name: str
    product: str
    limit_usd: float = Field(default=0.10, gt=0)


class TeamUpdateBudget(BaseModel):
    limit_usd: float = Field(gt=0)
    confirm_reduction: bool = Field(default=False)


class AgentUpdateBudget(BaseModel):
    monthly_budget: float = Field(gt=0)
    default_session_budget: Optional[float] = Field(default=None, gt=0)


class AgentCreate(BaseModel):
    team_id: str
    name: str
    slug: str
    monthly_budget: float = Field(default=0.04, gt=0)
    default_session_budget: float = Field(default=0.01, gt=0)
    preferred_model: str = Field(default="openai/gpt-oss-120b")
    fallback_model: Optional[str] = Field(default="openai/gpt-oss-20b")
    warning_percent: int = Field(default=80, ge=50, le=99)


class AgentUpdate(BaseModel):
    name: Optional[str] = None
    preferred_model: Optional[str] = None
    fallback_model: Optional[str] = None
    default_session_budget: Optional[float] = None
    warning_percent: Optional[int] = None


class WebhookCreate(BaseModel):
    name: str
    url: str
    enabled: bool = Field(default=True)
    subscribed_events: List[str] = Field(default_factory=lambda: ["BUDGET_WARNING", "BUDGET_EXHAUSTED", "MODEL_REROUTED", "RUNAWAY_AGENT_PAUSED", "AGENT_RESUMED", "AGENT_KEY_REVOKED"])
    secret: Optional[str] = None


class WebhookUpdate(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    enabled: Optional[bool] = None
    subscribed_events: Optional[List[str]] = None
    secret: Optional[str] = None


class IncidentAction(BaseModel):
    reviewer: Optional[str] = Field(default="admin-operator")
    reason: Optional[str] = None


class AuthLoginRequest(BaseModel):
    admin_key: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = Field(default="ADMIN")


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    role: str
