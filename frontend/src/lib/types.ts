import React from 'react';

export type Overview = {
  metrics: { spent: number; reserved: number; agents: number; requests: number; warnings: number; blocks: number };
  budgets: { id: string; scope: string; limit: number; spent: number; reserved: number; percent: number }[];
  agents: { slug: string; name: string; status: string; preferred_model: string; fallback_model: string }[];
  requests: { id: string; decision: string; requested: string; selected?: string; actual: number; created_at: string }[];
};

export type AdminTeam = {
  id: string; name: string; product: string; limit: number; spent: number;
  reserved: number; remaining: number; percent: number; agent_count: number;
  agents: { slug: string; name: string; status: string }[];
};

export type AdminAgent = {
  id: string; team_id: string; team_name: string; slug: string; name: string;
  status: string; key_prefix: string; preferred_model: string; fallback_model: string;
  monthly_budget: number; spent: number; default_session_budget: number;
  warning_percent: number; hourly_burn: number;
};

export type AdminKey = {
  agent_slug: string; agent_name: string; team_name: string;
  key_prefix: string; status: string;
};

export type RequestDetail = {
  id: string;
  agent?: { slug: string; name: string };
  team?: { name: string; product: string };
  session_id: string; requested_model: string; selected_model?: string;
  decision: string; reason?: string; estimated_cost: number; actual_cost: number;
  input_tokens?: number; output_tokens?: number; reasoning_tokens?: number;
  cached_tokens?: number; provider_request_id?: string; idempotency_key?: string;
  cache_hit?: boolean; reservation_status?: string; sequence_visual?: string[];
  created_at: string;
  ledger_events: { id: string; event_type: string; metadata: any; created_at: string }[];
};

export type SessionItem = {
  id: string; agent_slug: string; agent_name: string; team_name: string;
  external_id: string; status: string; budget_limit: number; spent: number;
  reserved: number; started_at: string; ended_at?: string;
};

export type IncidentItem = {
  id: string; agent_slug: string; agent_name: string; team_name: string;
  kind: string; severity: string; status: string; reviewer?: string;
  metadata: any; created_at: string; resolved_at?: string;
};

export type IncidentDetail = {
  id: string; kind: string; severity: string; status: string; reviewer?: string;
  agent?: { slug: string; name: string; status: string; preferred_model: string };
  team?: { name: string; product: string };
  monthly_limit: number; hourly_spend: number; percent_consumed: number;
  metadata: any; created_at: string; resolved_at?: string;
  recent_requests: { id: string; requested_model: string; selected_model?: string; decision: string; actual_cost: number; created_at: string }[];
};

export type WebhookItem = {
  id: string; name: string; url: string; enabled: boolean;
  subscribed_events: string[]; has_secret: boolean; created_at: string;
};

export type WebhookDelivery = {
  id: string; event_type: string; payload: any; status_code?: number;
  success: boolean; error?: string; created_at: string;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string | React.ReactNode;
  timestamp: string;
  decision?: 'ALLOW' | 'REROUTE' | 'BLOCK' | 'PAUSE';
  requestedModel?: string;
  selectedModel?: string;
  estimatedCost?: number;
  actualCost?: number;
  requestId?: string;
  tokens?: { input: number; output: number };
  errorDetails?: string;
};

export type TabId = 'playground' | 'overview' | 'fleet' | 'audit' | 'admin' | 'docs';
