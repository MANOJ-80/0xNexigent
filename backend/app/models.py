import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class AgentStatus(str, enum.Enum):
    active = "ACTIVE"
    paused = "PAUSED"


class SessionStatus(str, enum.Enum):
    active = "ACTIVE"
    exhausted = "EXHAUSTED"
    closed = "CLOSED"


class Decision(str, enum.Enum):
    allow = "ALLOW"
    reroute = "REROUTE"
    block = "BLOCK"
    pause = "PAUSE"


class IncidentStatus(str, enum.Enum):
    open = "OPEN"
    acknowledged = "ACKNOWLEDGED"
    resolved = "RESOLVED"


class IncidentSeverity(str, enum.Enum):
    high = "HIGH"
    critical = "CRITICAL"


class AdminRole(str, enum.Enum):
    admin = "ADMIN"
    operator = "OPERATOR"
    viewer = "VIEWER"


class Organization(Base):
    __tablename__ = "organizations"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(160), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Team(Base):
    __tablename__ = "teams"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id"), index=True)
    name: Mapped[str] = mapped_column(String(160))
    product: Mapped[str] = mapped_column(String(160))


class Agent(Base):
    __tablename__ = "agents"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    team_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("teams.id"), index=True)
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(160))
    api_key_hash: Mapped[str] = mapped_column(String(64), unique=True)
    key_prefix: Mapped[str] = mapped_column(String(24), default="nx_ag_...")
    preferred_model: Mapped[str] = mapped_column(String(160))
    fallback_model: Mapped[str | None] = mapped_column(String(160), nullable=True)
    default_session_budget: Mapped[float] = mapped_column(Numeric(12, 6), default=0.01)
    warning_percent: Mapped[int] = mapped_column(default=80)
    status: Mapped[str] = mapped_column(String(32), default="ACTIVE")


class Session(Base):
    __tablename__ = "sessions"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("agents.id"), index=True)
    external_id: Mapped[str] = mapped_column(String(160), index=True)
    status: Mapped[str] = mapped_column(String(32), default="ACTIVE")
    budget_limit: Mapped[float] = mapped_column(Numeric(12, 6), default=0.01)
    spent: Mapped[float] = mapped_column(Numeric(12, 6), default=0)
    reserved: Mapped[float] = mapped_column(Numeric(12, 6), default=0)
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Budget(Base):
    __tablename__ = "budgets"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scope_type: Mapped[str] = mapped_column(String(16), index=True)
    scope_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    period: Mapped[str] = mapped_column(String(16), default="monthly")
    limit_usd: Mapped[float] = mapped_column(Numeric(12, 6))
    warning_percent: Mapped[int] = mapped_column(default=80)
    spent_usd: Mapped[float] = mapped_column(Numeric(12, 6), default=0)
    reserved_usd: Mapped[float] = mapped_column(Numeric(12, 6), default=0)
    warning_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    period_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)



class RequestLog(Base):
    __tablename__ = "request_logs"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("agents.id"), index=True)
    session_id: Mapped[str] = mapped_column(String(160), index=True)
    requested_model: Mapped[str] = mapped_column(String(160))
    selected_model: Mapped[str | None] = mapped_column(String(160), nullable=True)
    decision: Mapped[str] = mapped_column(String(32))
    estimated_cost_usd: Mapped[float] = mapped_column(Numeric(12, 6), default=0)
    actual_cost_usd: Mapped[float | None] = mapped_column(Numeric(12, 6), nullable=True)
    input_tokens: Mapped[int | None] = mapped_column(nullable=True)
    output_tokens: Mapped[int | None] = mapped_column(nullable=True)
    reasoning_tokens: Mapped[int | None] = mapped_column(nullable=True)
    cached_tokens: Mapped[int | None] = mapped_column(nullable=True)
    reason: Mapped[str | None] = mapped_column(String(120), nullable=True)
    provider_request_id: Mapped[str | None] = mapped_column(String(160), nullable=True)
    idempotency_key: Mapped[str | None] = mapped_column(String(160), nullable=True, index=True)
    cache_hit: Mapped[bool] = mapped_column(Boolean, default=False)
    reservation_status: Mapped[str] = mapped_column(String(32), default="COMPLETED")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class LedgerEvent(Base):
    __tablename__ = "ledger_events"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    request_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), index=True, nullable=True)
    event_type: Mapped[str] = mapped_column(String(80), index=True)
    metadata_json: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Incident(Base):
    __tablename__ = "incidents"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("agents.id"), index=True)
    team_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("teams.id"), nullable=True, index=True)
    kind: Mapped[str] = mapped_column(String(80))
    severity: Mapped[str] = mapped_column(String(32), default="CRITICAL")
    status: Mapped[str] = mapped_column(String(32), default="OPEN")
    reviewer: Mapped[str | None] = mapped_column(String(160), nullable=True)
    metadata_json: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Webhook(Base):
    __tablename__ = "webhooks"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(160))
    url: Mapped[str] = mapped_column(String(500))
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    subscribed_events: Mapped[list] = mapped_column(JSONB, default=list)
    secret: Mapped[str | None] = mapped_column(String(160), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class WebhookDelivery(Base):
    __tablename__ = "webhook_deliveries"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    webhook_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("webhooks.id"), index=True)
    event_type: Mapped[str] = mapped_column(String(80))
    payload: Mapped[dict] = mapped_column(JSONB, default=dict)
    status_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    success: Mapped[bool] = mapped_column(Boolean, default=False)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
