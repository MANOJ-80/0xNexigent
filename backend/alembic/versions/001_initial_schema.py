"""initial_schema

Revision ID: 001_initial_schema
Revises: 
Create Date: 2026-08-19 10:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '001_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'organizations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(160), unique=True, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )

    op.create_table(
        'teams',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id'), nullable=False, index=True),
        sa.Column('name', sa.String(160), nullable=False),
        sa.Column('product', sa.String(160), nullable=False),
    )

    op.create_table(
        'agents',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('team_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('teams.id'), nullable=False, index=True),
        sa.Column('slug', sa.String(100), unique=True, index=True, nullable=False),
        sa.Column('name', sa.String(160), nullable=False),
        sa.Column('api_key_hash', sa.String(64), unique=True, nullable=False),
        sa.Column('key_prefix', sa.String(24), server_default='nx_ag_...'),
        sa.Column('preferred_model', sa.String(160), nullable=False),
        sa.Column('fallback_model', sa.String(160), nullable=True),
        sa.Column('default_session_budget', sa.Numeric(12, 6), server_default='0.01'),
        sa.Column('warning_percent', sa.Integer(), server_default='80'),
        sa.Column('status', sa.String(32), server_default='ACTIVE'),
    )

    op.create_table(
        'sessions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('agent_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('agents.id'), nullable=False, index=True),
        sa.Column('external_id', sa.String(160), index=True, nullable=False),
        sa.Column('status', sa.String(32), server_default='ACTIVE'),
        sa.Column('budget_limit', sa.Numeric(12, 6), server_default='0.01'),
        sa.Column('spent', sa.Numeric(12, 6), server_default='0'),
        sa.Column('reserved', sa.Numeric(12, 6), server_default='0'),
        sa.Column('opened_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('closed_at', sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        'budgets',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('scope_type', sa.String(16), index=True, nullable=False),
        sa.Column('scope_id', postgresql.UUID(as_uuid=True), index=True, nullable=False),
        sa.Column('period', sa.String(16), server_default='monthly'),
        sa.Column('limit_usd', sa.Numeric(12, 6), nullable=False),
        sa.Column('warning_percent', sa.Integer(), server_default='80'),
        sa.Column('spent_usd', sa.Numeric(12, 6), server_default='0'),
        sa.Column('reserved_usd', sa.Numeric(12, 6), server_default='0'),
        sa.Column('warning_sent', sa.Boolean(), server_default='false'),
        sa.Column('period_start', sa.DateTime(timezone=True), nullable=True),
        sa.Column('period_end', sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        'request_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('agent_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('agents.id'), nullable=False, index=True),
        sa.Column('session_id', sa.String(160), index=True, nullable=False),
        sa.Column('requested_model', sa.String(160), nullable=False),
        sa.Column('selected_model', sa.String(160), nullable=True),
        sa.Column('decision', sa.String(32), nullable=False),
        sa.Column('estimated_cost_usd', sa.Numeric(12, 6), server_default='0'),
        sa.Column('actual_cost_usd', sa.Numeric(12, 6), nullable=True),
        sa.Column('input_tokens', sa.Integer(), nullable=True),
        sa.Column('output_tokens', sa.Integer(), nullable=True),
        sa.Column('reasoning_tokens', sa.Integer(), nullable=True),
        sa.Column('cached_tokens', sa.Integer(), nullable=True),
        sa.Column('reason', sa.String(120), nullable=True),
        sa.Column('provider_request_id', sa.String(160), nullable=True),
        sa.Column('idempotency_key', sa.String(160), index=True, nullable=True),
        sa.Column('cache_hit', sa.Boolean(), server_default='false'),
        sa.Column('reservation_status', sa.String(32), server_default='COMPLETED'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )

    op.create_table(
        'ledger_events',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('request_id', postgresql.UUID(as_uuid=True), index=True, nullable=True),
        sa.Column('event_type', sa.String(80), index=True, nullable=False),
        sa.Column('metadata_json', postgresql.JSONB(), server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )

    op.create_table(
        'incidents',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('agent_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('agents.id'), nullable=False, index=True),
        sa.Column('team_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('teams.id'), nullable=True, index=True),
        sa.Column('kind', sa.String(80), nullable=False),
        sa.Column('severity', sa.String(32), server_default='CRITICAL'),
        sa.Column('status', sa.String(32), server_default='OPEN'),
        sa.Column('reviewer', sa.String(160), nullable=True),
        sa.Column('metadata_json', postgresql.JSONB(), server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        'webhooks',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(160), nullable=False),
        sa.Column('url', sa.String(500), nullable=False),
        sa.Column('enabled', sa.Boolean(), server_default='true'),
        sa.Column('subscribed_events', postgresql.JSONB(), server_default='[]'),
        sa.Column('secret', sa.String(160), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )

    op.create_table(
        'webhook_deliveries',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('webhook_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('webhooks.id'), nullable=False, index=True),
        sa.Column('event_type', sa.String(80), nullable=False),
        sa.Column('payload', postgresql.JSONB(), server_default='{}'),
        sa.Column('status_code', sa.Integer(), nullable=True),
        sa.Column('success', sa.Boolean(), server_default='false'),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )


def downgrade() -> None:
    op.drop_table('webhook_deliveries')
    op.drop_table('webhooks')
    op.drop_table('incidents')
    op.drop_table('ledger_events')
    op.drop_table('request_logs')
    op.drop_table('budgets')
    op.drop_table('sessions')
    op.drop_table('agents')
    op.drop_table('teams')
    op.drop_table('organizations')
