import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import '../styles.css';
import { Key, MessageSquare, BarChart, Building, Search, Settings, Sparkles, RefreshCw, Zap, Eraser, ShieldAlert, CheckCircle, AlertTriangle, Play, Square, Send, Copy, X, Lock, Eye, Check, BookOpen, Activity, Terminal, Shield, Database, Cloud } from 'lucide-react';

import { Overview, SessionItem, IncidentItem, IncidentDetail, AdminTeam, AdminAgent, AdminKey, WebhookItem, WebhookDelivery, ChatMessage, RequestDetail, TabId } from '../lib/types';
import { money, displayPercent, budgetState as state } from '../lib/utils';
import { getAuthHeaders, isAuthenticated, logout } from '../lib/auth';
import { DocsTab } from '../components/DocsTab';


const TiltCard = ({ children, style, className = '' }: any) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [coords, setCoords] = React.useState({ x: 0, y: 0 });
  
  const mouseXSpring = useSpring(x, { stiffness: 300, damping: 30 });
  const mouseYSpring = useSpring(y, { stiffness: 300, damping: 30 });
  
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["3deg", "-3deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-3deg", "3deg"]);
  
  const handleMouseMove = (e: any) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    setCoords({ x: mouseX, y: mouseY });
    
    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;
    x.set(xPct);
    y.set(yPct);
  };
  
  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };
  
  return (
    <motion.article 
      className={`spotlight-card ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        ...style,
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
        perspective: 1500,
        position: 'relative',
        '--mouse-x': `${coords.x}px`,
        '--mouse-y': `${coords.y}px`
      } as any}
      whileHover={{ scale: 1.01, boxShadow: "0 10px 30px rgba(122,104,255,0.15)", borderColor: "var(--purple)" }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      <div style={{ transform: "translateZ(10px)", position: "relative", zIndex: 1, height: '100%' }}>
        {children}
      </div>
    </motion.article>
  );
};

function App() {
  const [data, setData] = useState<Overview | null>(null);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [sessionFilterStatus, setSessionFilterStatus] = useState<string>('ALL');

  const [incidents, setIncidents] = useState<IncidentItem[]>([]);
  const [incidentDetail, setIncidentDetail] = useState<IncidentDetail | null>(null);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);

  const [adminTeams, setAdminTeams] = useState<AdminTeam[]>([]);
  const [adminAgents, setAdminAgents] = useState<AdminAgent[]>([]);
  const [adminKeys, setAdminKeys] = useState<AdminKey[]>([]);

  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [webhookDeliveries, setWebhookDeliveries] = useState<WebhookDelivery[]>([]);
  const [selectedWebhookId, setSelectedWebhookId] = useState<string | null>(null);
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [webhookName, setWebhookName] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');

  const [running, setRunning] = useState<string | null>(null);
  const [notice, setNotice] = useState('LIVE CONTROL PLANE CONNECTED');
  const [activeTab, setActiveTab] = useState<'playground' | 'overview' | 'fleet' | 'audit' | 'admin' | 'docs'>('playground');
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [requestDetail, setRequestDetail] = useState<RequestDetail | null>(null);

  // Authentication UI State
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authRole, setAuthRole] = useState<'ADMIN' | 'OPERATOR' | 'VIEWER'>('ADMIN');
  const [authKey, setAuthKey] = useState('');
  const [authUsername, setAuthUsername] = useState('admin@nexigent.io');
  const [isAuthSuccess, setIsAuthSuccess] = useState<boolean>(() => !!localStorage.getItem('nexigent_jwt_token'));

  const handleLogin = async () => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_key: authKey, username: authUsername, role: authRole }),
      });
      if (res.ok) {
        const authRes = await res.json();
        localStorage.setItem('nexigent_jwt_token', authRes.access_token);
        setIsAuthSuccess(true);
        setNotice(`JWT AUTHENTICATED AS ${authRes.role}`);
        setShowAuthModal(false);
        load();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`Authentication Failed: ${err.detail?.message || 'Invalid administrative secret key.'}`);
      }
    } catch (err: any) {
      alert(`Login error: ${err.message}`);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('nexigent_jwt_token');
    setIsAuthSuccess(false);
    setNotice('LOGGED OUT — FALLBACK MODE');
    load();
  };

  // Fleet & Budget Control State
  const [selectedAgentDetail, setSelectedAgentDetail] = useState<AdminAgent | null>(null);
  const [editingAgentSlug, setEditingAgentSlug] = useState<string | null>(null);
  const [editAgentMonthlyVal, setEditAgentMonthlyVal] = useState<string>('');
  const [editAgentSessionVal, setEditAgentSessionVal] = useState<string>('');

  // Playground state
  const [playgroundAgent, setPlaygroundAgent] = useState<string>('research-agent');
  const [playgroundSessionId, setPlaygroundSessionId] = useState<string>('session-pg-1');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-init-1',
      role: 'assistant',
      content: 'Hello! I am your AI Agent running behind the 0xNexigent LLM Budget Gateway. Chat with me naturally to test real-time budget enforcement (ALLOW, REROUTE, BLOCK, or PAUSE).',
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);
  const [userPrompt, setUserPrompt] = useState<string>('');
  const [maxTokens, setMaxTokens] = useState<number>(250);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [activePreset, setActivePreset] = useState<'normal' | 'reroute' | 'block' | 'custom'>('normal');

  const [lastExecution, setLastExecution] = useState<{
    decision: string;
    requestedModel: string;
    selectedModel: string;
    estimatedCost: number;
    actualCost: number;
    tokens: { input: number; output: number };
    latencyMs: number;
    requestId: string;
  } | null>(null);

  // Simulation Modal State
  const [showSimulation, setShowSimulation] = useState<{ active: boolean; type: string; step: number; result: any; message: string }>({ active: false, type: '', step: 0, result: null, message: '' });

  // Raw Key Issued Modal State
  const [issuedKey, setIssuedKey] = useState<{ raw_key: string; agent: string; prefix: string } | null>(null);

  // Forms State
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamProduct, setNewTeamProduct] = useState('');
  const [newTeamLimit, setNewTeamLimit] = useState('0.10');

  const [showAgentModal, setShowAgentModal] = useState(false);
  const [newAgentTeamId, setNewAgentTeamId] = useState('');
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentSlug, setNewAgentSlug] = useState('');
  const [newAgentMonthlyLimit, setNewAgentMonthlyLimit] = useState('0.04');
  const [newAgentSessionLimit, setNewAgentSessionLimit] = useState('0.01');
  const [newAgentPreferredModel, setNewAgentPreferredModel] = useState('openai/gpt-oss-120b');
  const [newAgentFallbackModel, setNewAgentFallbackModel] = useState('openai/gpt-oss-20b');
  const [newAgentWarningPercent, setNewAgentWarningPercent] = useState('80');

  // Team Budget Reduction Safeguard Modal
  const [reductionWarning, setReductionWarning] = useState<{ teamId: string; teamName: string; newLimit: number; detail: any } | null>(null);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editLimitVal, setEditLimitVal] = useState('');

  const load = () => {
    const t = Date.now();
    fetch(`/api/overview?t=${t}`, { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then(setData)
      .catch(() => setNotice('GATEWAY UNAVAILABLE'));
    fetch(`/api/sessions?t=${t}`, { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then(setSessions)
      .catch(() => {});
    fetch(`/api/incidents?t=${t}`, { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then(setIncidents)
      .catch(() => {});
    fetch(`/api/admin/teams?t=${t}`, { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((teams) => {
        if (Array.isArray(teams)) {
          setAdminTeams(teams);
          if (teams.length > 0 && !newAgentTeamId) setNewAgentTeamId(teams[0].id);
        }
      })
      .catch(() => {});
    fetch(`/api/admin/agents?t=${t}`, { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((agents) => { if (Array.isArray(agents)) setAdminAgents(agents); })
      .catch(() => {});
    fetch(`/api/admin/keys?t=${t}`, { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((keys) => { if (Array.isArray(keys)) setAdminKeys(keys); })
      .catch(() => {});
    fetch(`/api/admin/webhooks?t=${t}`, { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((whs) => { if (Array.isArray(whs)) setWebhooks(whs); })
      .catch(() => {});
  };


  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isSending]);

  const handleAgentChange = (newAgentSlug: string) => {
    setPlaygroundAgent(newAgentSlug);
    const existingActive = sessions.find((s) => s.agent_slug === newAgentSlug && s.status === 'ACTIVE');
    if (existingActive) {
      setPlaygroundSessionId(existingActive.external_id);
    } else {
      const newSessId = `session-${newAgentSlug.split('-')[0]}-${Date.now().toString().slice(-4)}`;
      setPlaygroundSessionId(newSessId);
    }
  };

  useEffect(() => {
    load();
    const token = localStorage.getItem('nexigent_jwt_token');
    const events = new EventSource(`/api/events?token=${token}`);
    events.onmessage = () => {
      load();
      setNotice('LIVE EVENT RECEIVED');
    };
    return () => events.close();
  }, []);

  const applyPreset = async (type: 'normal' | 'reroute' | 'block') => {
    setActivePreset(type);
    setNotice(`APPLYING ${type.toUpperCase()} DEMO POLICY PRESET...`);
    try {
      if (type === 'reroute') {
        await fetch('/api/demo/scenarios/reroute', { method: 'POST', headers: getAuthHeaders() });
        await fetch('/api/sessions/reroute-real/budget', {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({ limit_usd: 0.000080 }),
        });
        await fetch('/api/sessions/reroute-real/reset', { method: 'POST', headers: getAuthHeaders() });
        setPlaygroundAgent('support-agent');
        setPlaygroundSessionId('reroute-real');
        setChatMessages([
          {
            id: `preset-rr-${Date.now()}`,
            role: 'assistant',
            content: <><AlertTriangle size={14} style={{ marginRight: "6px", display: "inline" }} /> Force Reroute Preset Active ($0.000080 Session Limit).\ngpt-oss-120b reservation (~$0.000154) exceeds limit → automatic fallback to gpt-oss-20b (~$0.000077).</>,
            timestamp: new Date().toLocaleTimeString(),
          }
        ]);
        setNotice('POLICY ACTIVE: Force Reroute (120B → 20B)');
      } else if (type === 'block') {
        await fetch('/api/demo/scenarios/block', { method: 'POST', headers: getAuthHeaders() });
        setPlaygroundAgent('support-agent');
        setPlaygroundSessionId('block-real');
        setChatMessages([
          {
            id: `preset-bl-${Date.now()}`,
            role: 'assistant',
            content: <><ShieldAlert size={14} style={{ marginRight: "6px", display: "inline" }} /> Force Hard Block Preset Active ($0.000010 Session Limit).\nRequests will be blocked pre-execution before reaching Groq.</>,
            timestamp: new Date().toLocaleTimeString(),
          }
        ]);
        setNotice('POLICY ACTIVE: Force Hard Budget Block');
      } else if (type === 'normal') {
        await fetch('/api/demo/reset', { method: 'POST', headers: getAuthHeaders() });
        setPlaygroundAgent('research-agent');
        const cleanSess = `session-pg-${Date.now().toString().slice(-4)}`;
        setPlaygroundSessionId(cleanSess);
        setChatMessages([
          {
            id: `preset-norm-${Date.now()}`,
            role: 'assistant',
            content: <><CheckCircle size={14} style={{ marginRight: "6px", display: "inline" }} /> Normal Chat Preset Active ($0.01 Session Limit).\nChat naturally with your AI Agent on openai/gpt-oss-120b.</>,
            timestamp: new Date().toLocaleTimeString(),
          }
        ]);
        setNotice('POLICY ACTIVE: Normal Chat ($0.01 Limit)');
      }
    } catch (e) {
      setNotice('FAILED TO APPLY PRESET');
    } finally {
      load();
    }
  };

  const resetCurrentSession = async () => {
    try {
      await fetch(`/api/sessions/${playgroundSessionId}/reset`, { method: 'POST', headers: getAuthHeaders() });
      setNotice(`SESSION ${playgroundSessionId} RESET TO $0.00 SPENT`);
      setChatMessages((prev) => [
        ...prev,
        {
          id: `msg-reset-${Date.now()}`,
          role: 'assistant',
          content: <><RefreshCw size={14} style={{ marginRight: "6px", display: "inline" }} /> Session {playgroundSessionId} budget spent reset to $0.00 & reactivated.</>,
          timestamp: new Date().toLocaleTimeString(),
        }
      ]);
    } catch (err) {
      setNotice('FAILED TO RESET SESSION');
    } finally {
      load();
    }
  };

  const sendChatMessage = async () => {
    if (!userPrompt.trim() || isSending) return;
    const promptText = userPrompt.trim();
    setUserPrompt('');
    setIsSending(true);

    const userMsg: ChatMessage = {
      id: `msg-user-${Date.now()}`,
      role: 'user',
      content: promptText,
      timestamp: new Date().toLocaleTimeString(),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    const agentKey = `nx_demo_${playgroundAgent}`;
    const startTime = performance.now();

    try {
      const res = await fetch('/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${agentKey}`,
        },
        body: JSON.stringify({
          model: 'openai/gpt-oss-120b',
          session_id: playgroundSessionId,
          max_tokens: maxTokens,
          messages: [
            ...chatMessages
              .filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && !m.content.includes('[Reasoning Trace]'))
              .slice(-6)
              .map(m => ({ role: m.role, content: m.content as string })),
            { role: 'user', content: promptText }
          ]
        })
      });

      const endTime = performance.now();
      const latencyMs = Math.round(endTime - startTime);

      const decision = res.headers.get('X-Nexigent-Decision') || (res.ok ? 'ALLOW' : 'BLOCK');
      const reqModel = res.headers.get('X-Nexigent-Requested-Model') || 'openai/gpt-oss-120b';
      const selModel = res.headers.get('X-Nexigent-Selected-Model') || (decision === 'REROUTE' ? 'openai/gpt-oss-20b' : reqModel);
      const reqId = res.headers.get('X-Nexigent-Request-Id') || '';
      const estCost = parseFloat(res.headers.get('X-Nexigent-Estimated-Cost') || '0');
      const actCost = parseFloat(res.headers.get('X-Nexigent-Actual-Cost') || '0');

      if (res.ok) {
        const data = await res.json();
        const msgObj = data.choices?.[0]?.message || {};
        let assistantText = msgObj.content?.trim();
        if (!assistantText) {
          if (msgObj.reasoning?.trim()) {
            assistantText = <><Sparkles size={14} style={{ marginRight: "6px", display: "inline" }} /> [Reasoning Trace (Token limit reached before output stream)]:\n\n{msgObj.reasoning.trim()}</>;
          } else {
            assistantText = 'Response completed with empty output.';
          }
        }
        const inTokens = data.usage?.prompt_tokens || 0;
        const outTokens = data.usage?.completion_tokens || 0;

        const assistantMsg: ChatMessage = {
          id: `msg-ast-${Date.now()}`,
          role: 'assistant',
          content: assistantText,
          timestamp: new Date().toLocaleTimeString(),
          decision: decision as any,
          requestedModel: reqModel,
          selectedModel: selModel,
          estimatedCost: estCost,
          actualCost: actCost,
          requestId: reqId,
          tokens: { input: inTokens, output: outTokens },
        };

        setChatMessages((prev) => [...prev, assistantMsg]);
        setLastExecution({
          decision,
          requestedModel: reqModel,
          selectedModel: selModel,
          estimatedCost: estCost,
          actualCost: actCost,
          tokens: { input: inTokens, output: outTokens },
          latencyMs,
          requestId: reqId,
        });
      } else {
        const errData = await res.json().catch(() => ({}));
        const errDetail = errData.detail || {};
        const errCode = typeof errDetail === 'object' ? (errDetail.code || 'BUDGET_EXHAUSTED') : 'BUDGET_EXHAUSTED';
        const errMsg = typeof errDetail === 'object' ? (errDetail.message || 'Request blocked by gateway governance policy.') : String(errDetail);

        const systemMsg: ChatMessage = {
          id: `msg-sys-${Date.now()}`,
          role: 'system',
          content: <><ShieldAlert size={14} style={{ marginRight: "6px", display: "inline" }} /> [GATEWAY {decision}]: {errCode} — {errMsg}</>,
          timestamp: new Date().toLocaleTimeString(),
          decision: decision as any,
          requestedModel: reqModel,
          selectedModel: selModel,
          estimatedCost: estCost,
          actualCost: 0,
          requestId: reqId,
          errorDetails: errMsg,
        };

        setChatMessages((prev) => [...prev, systemMsg]);
        setLastExecution({
          decision,
          requestedModel: reqModel,
          selectedModel: selModel,
          estimatedCost: estCost,
          actualCost: 0,
          tokens: { input: 0, output: 0 },
          latencyMs,
          requestId: reqId,
        });
      }
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `msg-err-${Date.now()}`,
        role: 'system',
        content: <><X size={14} style={{ marginRight: "6px", display: "inline" }} /> Network / Gateway Error: {err.message}</>,
        timestamp: new Date().toLocaleTimeString(),
        decision: 'BLOCK',
      };
      setChatMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsSending(false);
      load();
    }
  };


  const openRequestDetail = (id: string) => {
    setSelectedRequestId(id);
    fetch(`/api/requests/${id}`, { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then(setRequestDetail)
      .catch(() => {});
  };

  const openIncidentDetail = (id: string) => {
    setSelectedIncidentId(id);
    fetch(`/api/incidents/${id}`, { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then(setIncidentDetail)
      .catch(() => {});
  };

  const closeSession = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/close`, { method: 'POST', headers: getAuthHeaders() });
      if (res.ok) {
        setNotice(`SESSION ${sessionId.slice(0, 8)}... CLOSED`);
        load();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleIncidentAction = async (actionType: 'acknowledge' | 'resolve' | 'keep-paused' | 'revoke-agent-key') => {
    if (!selectedIncidentId) return;
    try {
      const res = await fetch(`/api/incidents/${selectedIncidentId}/${actionType}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ reviewer: 'Security Admin' }),
      });
      if (res.ok) {
        setNotice(`INCIDENT ACTION: ${actionType.toUpperCase()}`);
        openIncidentDetail(selectedIncidentId);
        load();
      } else {
        const err = await res.json();
        alert(`Action failed: ${JSON.stringify(err.detail)}`);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/webhooks', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: webhookName,
          url: webhookUrl,
          secret: webhookSecret || null,
          enabled: true,
          subscribed_events: ['*'],
        }),
      });
      if (res.ok) {
        setShowWebhookModal(false);
        setWebhookName('');
        setWebhookUrl('');
        setWebhookSecret('');
        setNotice('WEBHOOK CREATED');
        load();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const testWebhook = async (webhookId: string) => {
    try {
      const res = await fetch(`/api/admin/webhooks/${webhookId}/test`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        setNotice('WEBHOOK TEST DISPATCHED');
        loadDeliveries(webhookId);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const loadDeliveries = (webhookId: string) => {
    setSelectedWebhookId(webhookId);
    fetch(`/api/admin/webhooks/${webhookId}/deliveries`, { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then(setWebhookDeliveries)
      .catch(() => {});
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/teams', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name: newTeamName, product: newTeamProduct, limit_usd: parseFloat(newTeamLimit) }),
      });
      if (res.ok) {
        setShowTeamModal(false);
        setNewTeamName('');
        setNewTeamProduct('');
        setNotice('TEAM CREATED SUCCESSFULLY');
        load();
      } else {
        const err = await res.json();
        alert(`Error creating team: ${JSON.stringify(err.detail)}`);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUpdateTeamBudget = async (teamId: string, limitUsd: number, confirm: boolean = false) => {
    try {
      const res = await fetch(`/api/admin/teams/${teamId}/budget`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ limit_usd: limitUsd, confirm_reduction: confirm }),
      });
      if (res.ok) {
        setReductionWarning(null);
        setEditingTeamId(null);
        setNotice('TEAM BUDGET UPDATED');
        load();
      } else {
        const err = await res.json();
        if (err.detail?.code === 'UNSAFE_BUDGET_REDUCTION') {
          const team = adminTeams.find((t) => t.id === teamId);
          setReductionWarning({
            teamId,
            teamName: team?.name || 'Team',
            newLimit: limitUsd,
            detail: err.detail,
          });
        } else {
          alert(`Error updating budget: ${JSON.stringify(err.detail)}`);
        }
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/agents', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          team_id: newAgentTeamId,
          name: newAgentName,
          slug: newAgentSlug,
          monthly_budget: parseFloat(newAgentMonthlyLimit),
          default_session_budget: parseFloat(newAgentSessionLimit),
          preferred_model: newAgentPreferredModel,
          fallback_model: newAgentFallbackModel || null,
          warning_percent: parseInt(newAgentWarningPercent, 10),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowAgentModal(false);
        setIssuedKey({ raw_key: data.raw_api_key, agent: data.name, prefix: data.key_prefix });
        setNewAgentName('');
        setNewAgentSlug('');
        setNotice(`AGENT ${data.name.toUpperCase()} CREATED`);
        load();
      } else {
        alert(`Error creating agent: ${JSON.stringify(data.detail)}`);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRotateKey = async (slug: string) => {
    if (!confirm(`Rotate API key for ${slug}? Old key will immediately stop working.`)) return;
    try {
      const res = await fetch(`/api/admin/agents/${slug}/rotate-key`, { method: 'POST', headers: getAuthHeaders() });
      const data = await res.json();
      if (res.ok) {
        setIssuedKey({ raw_key: data.raw_api_key, agent: slug, prefix: data.key_prefix });
        setNotice(`KEY ROTATED FOR ${slug.toUpperCase()}`);
        load();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRevokeKey = async (slug: string) => {
    if (!confirm(`REVOKE gateway API key for ${slug}? Agent will be PAUSED.`)) return;
    try {
      const res = await fetch(`/api/admin/agents/${slug}/revoke-key`, { method: 'POST', headers: getAuthHeaders() });
      if (res.ok) {
        setNotice(`KEY REVOKED FOR ${slug.toUpperCase()}`);
        load();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const run = async (agent_slug: string) => {
    setRunning(agent_slug);
    setNotice(`RUNNING REAL GROQ REQUEST / ${agent_slug.toUpperCase()}`);
    try {
      const response = await fetch('/api/demo/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          agent_slug,
          session_id: `demo-${agent_slug}`,
          prompt: 'Respond with one sentence describing why pre-execution LLM budget controls matter.',
          max_tokens: 120,
        }),
      });
      const result = await response.json();
      setNotice(
        response.ok
          ? `${result.decision} / ${result.model}`
          : `${result.detail?.code || 'REQUEST FAILED'} / ${result.detail?.message || ''}`
      );
      load();
    } finally {
      setRunning(null);
    }
  };

  const runScenario = async (scenario: 'reroute' | 'block' | 'warning' | 'runaway') => {
    setRunning(scenario);
    setShowSimulation({ active: true, type: scenario, step: 0, result: null, message: 'Intercepting Request...' });
    
    // Simulate initial delay for animation
    await new Promise(r => setTimeout(r, 600));
    setShowSimulation(s => ({ ...s, step: 1, message: 'Acquiring Redis Distributed Lock & Evaluating Budget...' }));

    try {
      const response = await fetch(`/api/demo/scenarios/${scenario}`, { method: 'POST', headers: getAuthHeaders() });
      const result = await response.json();
      
      await new Promise(r => setTimeout(r, 800));
      setShowSimulation(s => ({ ...s, step: 2, message: 'Applying Governance Policy...' }));
      
      await new Promise(r => setTimeout(r, 800));
      setShowSimulation(s => ({ ...s, step: 3, result: result, message: response.ok ? `DECISION: ${result.decision}` : `BLOCKED: ${result.detail?.code}` }));

      setNotice(
        response.ok
          ? `${result.decision} / ${result.model}`
          : `${result.detail?.code || 'REQUEST FAILED'} / ${result.detail?.message || ''}`
      );
      load();
    } finally {
      setRunning(null);
    }
  };

  const resumeLoop = async () => {
    setRunning('resume');
    try {
      const response = await fetch('/api/agents/loop-agent/resume', { method: 'POST', headers: getAuthHeaders() });
      setNotice(response.ok ? 'LOOP AGENT RESUMED / AUDITED' : 'RESUME FAILED');
      load();
    } finally {
      setRunning(null);
    }
  };

  const handleUpdateAgentBudget = async (slug: string, monthly: number, sessionVal?: number) => {
    try {
      const res = await fetch(`/api/admin/agents/${slug}/budget`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ monthly_budget: monthly, default_session_budget: sessionVal }),
      });
      if (res.ok) {
        setNotice(`BUDGET UPDATED FOR AGENT ${slug.toUpperCase()}`);
        setEditingAgentSlug(null);
        load();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`Error updating agent budget: ${err.detail || 'Request failed'}`);
      }
    } catch (err: any) {
      alert(`Failed to update agent budget: ${err.message}`);
    }
  };

  const handleToggleAgentStatus = async (slug: string, currentStatus: string) => {
    const newStatus = currentStatus.toUpperCase() === 'PAUSED' ? 'ACTIVE' : 'PAUSED';
    try {
      const res = await fetch(`/api/admin/agents/${slug}/status?status=${newStatus}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        setNotice(`AGENT ${slug.toUpperCase()} SET TO ${newStatus}`);
        load();
      }
    } catch (err: any) {
      alert(`Failed to toggle status: ${err.message}`);
    }
  };

  const applyEnterprise3TierDefaults = async () => {
    if (!confirm('Apply Enterprise 3-Tier Defaults ($500 Team / $50 Agent / $2 Session) across all teams & agents?')) return;
    try {
      for (const team of adminTeams) {
        await fetch(`/api/admin/teams/${team.id}/budget`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({ limit_usd: 500.0, confirm_reduction: true }),
        });
      }
      for (const agent of adminAgents) {
        await fetch(`/api/admin/agents/${agent.slug}/budget`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({ monthly_budget: 50.0, default_session_budget: 2.0 }),
        });
      }
      setNotice('ENTERPRISE 3-TIER DEFAULTS APPLIED ($500 TEAM / $50 AGENT / $2 SESSION)');
      load();
    } catch (err: any) {
      alert(`Error setting defaults: ${err.message}`);
    }
  };

  if (!data) return <main className="loading">INITIALISING 0XNEXIGENT…</main>;
  const critical = data.agents.filter((a) => a.status === 'PAUSED');

  const filteredSessions = sessionFilterStatus === 'ALL'
    ? sessions
    : sessions.filter((s) => s.status.toUpperCase() === sessionFilterStatus);

  return (
    <main>
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p className="tag">&lt; 0XNEXIGENT / ENTERPRISE GOVERNANCE GATEWAY &gt;</p>
          <h1>
            Spend control <em>before</em> execution.
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            className="secondary"
            style={{
              background: isAuthSuccess ? 'rgba(16, 185, 129, 0.15)' : 'rgba(139, 92, 246, 0.15)',
              borderColor: isAuthSuccess ? '#10b981' : '#8b5cf6',
              color: isAuthSuccess ? '#34d399' : '#c084fc',
              padding: '6px 12px',
              fontSize: '11px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
            onClick={() => setShowAuthModal(true)}
          >
            <Key size={14} style={{ marginRight: "6px" }} /> {isAuthSuccess ? `AUTHENTICATED: ${authRole} (JWT)` : 'ADMIN LOGIN (JWT)'}
          </button>
          <div className="live">
            <i /> {notice}
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="nav-tabs">
        <button className={`tab-btn ${activeTab === 'playground' ? 'active' : ''}`} onClick={() => setActiveTab('playground')}>
          [ AGENT PLAYGROUND <MessageSquare size={14} style={{ marginLeft: "6px" }} /> ]
        </button>
        <button className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
          [ OVERVIEW & ANALYTICS <BarChart size={14} style={{ marginLeft: "6px" }} /> ]
        </button>
        <button className={`tab-btn ${activeTab === 'fleet' ? 'active' : ''}`} onClick={() => setActiveTab('fleet')}>
          [ FLEET & BUDGET CONTROL <Building size={14} style={{ marginLeft: "6px" }} /> ]
        </button>
        <button className={`tab-btn ${activeTab === 'audit' ? 'active' : ''}`} onClick={() => setActiveTab('audit')}>
          [ AUDIT & TRACE LOGS <Search size={14} style={{ marginLeft: "6px" }} /> ]
        </button>
        <button className={`tab-btn ${activeTab === 'admin' ? 'active' : ''}`} onClick={() => setActiveTab('admin')}>
          [ ADMIN CONFIG & KEYS <Settings size={14} style={{ marginLeft: "6px" }} /> ]
        </button>
        <button className={`tab-btn ${activeTab === 'docs' ? 'active' : ''}`} onClick={() => setActiveTab('docs')}>
          [ DEVELOPER DOCS <BookOpen size={14} style={{ marginLeft: "6px" }} /> ]
        </button>
      </nav>

      <AnimatePresence mode="wait">

      {/* TAB 0: AGENT PLAYGROUND */}
      {activeTab === 'playground' && (
        <motion.div key="playground" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }} style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
          {/* Top Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0, marginBottom: '24px' }}>
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: '0 0 8px 0', fontFamily: 'var(--font-mono)' }}>&gt; nx_gateway runtime --attach</p>
              <h1 style={{ fontSize: '28px', fontWeight: 600, margin: 0, color: '#fff' }}>Interactive Test Console</h1>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button style={{ padding: '8px 16px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid var(--blue)', color: 'var(--blue)', borderRadius: '8px', fontSize: '11px', fontWeight: 700 }} onClick={() => applyPreset('normal')}>
                <CheckCircle size={14} style={{ marginRight: "6px", display: "inline" }} /> NORMAL ($0.01)
              </button>
              <button style={{ padding: '8px 16px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid var(--amber)', color: 'var(--amber)', borderRadius: '8px', fontSize: '11px', fontWeight: 700 }} onClick={() => applyPreset('reroute')}>
                <RefreshCw size={14} style={{ marginRight: "6px", display: "inline" }} /> FORCE REROUTE ($0.000055)
              </button>
              <button style={{ padding: '8px 16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--red)', color: 'var(--red)', borderRadius: '8px', fontSize: '11px', fontWeight: 700 }} onClick={() => applyPreset('block')}>
                <ShieldAlert size={14} style={{ marginRight: "6px", display: "inline" }} /> FORCE BLOCK ($0.000010)
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '24px', flex: 1, minHeight: 0 }}>
            {/* LEFT: TERMINAL CHAT */}
            <div style={{ background: '#0a0a0c', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: 'inset 0 0 40px rgba(0,0,0,0.5)' }}>
              {/* Terminal Header */}
              <div style={{ background: '#121214', padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ef4444' }}></div>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#f59e0b' }}></div>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#10b981' }}></div>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                  root@nx-gateway:~# tail -f /var/log/session_{playgroundSessionId}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <select style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '11px', fontFamily: 'var(--font-mono)', outline: 'none' }} value={playgroundAgent} onChange={(e) => handleAgentChange(e.target.value)}>
                    {data?.agents.map((ag) => (
                      <option key={ag.slug} value={ag.slug}>{ag.slug}</option>
                    )) || (
                      <>
                        <option value="research-agent">research-agent</option>
                        <option value="support-agent">support-agent</option>
                      </>
                    )}
                  </select>
                  <button style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => setChatMessages([])}>
                    <Eraser size={14} />
                  </button>
                </div>
              </div>

              {/* Chat Messages */}
              <div id="chat-scroll-container" style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {chatMessages.map((msg) => (
                  <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div style={{ maxWidth: '80%', background: msg.role === 'user' ? 'var(--blue)' : 'rgba(255,255,255,0.05)', padding: '12px 16px', borderRadius: '12px', borderBottomRightRadius: msg.role === 'user' ? '2px' : '12px', borderBottomLeftRadius: msg.role !== 'user' ? '2px' : '12px', color: '#fff', fontSize: '13px', lineHeight: '1.5', fontFamily: msg.role === 'system' ? 'var(--font-mono)' : 'inherit', border: msg.role === 'system' ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
                      {msg.content}
                    </div>

                    {msg.decision && (
                      <div style={{ display: 'flex', gap: '8px', marginTop: '6px', fontSize: '9px', fontFamily: 'var(--font-mono)', alignItems: 'center', background: 'rgba(0,0,0,0.4)', padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <span style={{ color: msg.decision === 'BLOCK' ? 'var(--red)' : msg.decision === 'REROUTE' ? 'var(--amber)' : 'var(--green)', fontWeight: 700 }}>
                          [{msg.decision}]
                        </span>
                        {msg.requestedModel && (
                          <span style={{ color: 'var(--text-muted)' }}>
                            {msg.decision === 'REROUTE' ? `${msg.requestedModel.split('/')[1]} → ${msg.selectedModel?.split('/')[1]}` : msg.requestedModel.split('/')[1]}
                          </span>
                        )}
                        {msg.actualCost !== undefined && msg.actualCost > 0 && (
                          <span style={{ color: '#fff' }}>ACTUAL: {money(msg.actualCost)}</span>
                        )}
                        {msg.estimatedCost !== undefined && msg.actualCost === 0 && (
                          <span style={{ color: 'var(--text-muted)' }}>EST: {money(msg.estimatedCost)}</span>
                        )}
                        {msg.tokens && (
                          <span style={{ color: 'var(--text-muted)' }}>{msg.tokens.input}+{msg.tokens.output} tok</span>
                        )}
                        {msg.requestId && (
                          <button style={{ background: 'transparent', border: 'none', color: 'var(--blue)', fontSize: '9px', fontFamily: 'var(--font-mono)', cursor: 'pointer', padding: 0, textDecoration: 'underline' }} onClick={() => openRequestDetail(msg.requestId!)}>
                            AUDIT TRACE
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {isSending && (
                  <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px 16px', borderRadius: '12px', borderBottomLeftRadius: '2px', color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '8px' }}>
                       <div className="spinner" style={{ width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--purple)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                       Gateway evaluating policy...
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Terminal Input */}
              <div style={{ padding: '16px 20px', background: '#121214', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                  <div style={{ color: 'var(--purple)', fontFamily: 'var(--font-mono)', fontSize: '14px', paddingTop: '8px', fontWeight: 700 }}>&gt;</div>
                  <textarea
                    style={{ flex: 1, background: 'transparent', border: 'none', color: '#fff', fontSize: '14px', fontFamily: 'var(--font-mono)', resize: 'none', height: '40px', outline: 'none', paddingTop: '8px' }}
                    placeholder="Type your prompt here..."
                    value={userPrompt}
                    onChange={(e) => setUserPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendChatMessage();
                      }
                    }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <select style={{ background: '#000', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)', fontSize: '10px', padding: '4px 8px', borderRadius: '4px', outline: 'none' }} value={maxTokens} onChange={(e) => setMaxTokens(Number(e.target.value))}>
                      <option value={60}>60 max_tokens</option>
                      <option value={120}>120 max_tokens</option>
                      <option value={250}>250 max_tokens</option>
                      <option value={1000}>1000 max_tokens</option>
                    </select>
                    <button style={{ background: 'var(--purple-glow)', border: '1px solid var(--purple)', color: '#fff', padding: '8px 16px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }} disabled={isSending || !userPrompt.trim()} onClick={sendChatMessage}>
                      {isSending ? 'SENDING...' : 'EXECUTE'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT: RUNTIME TELEMETRY */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto', paddingRight: '4px' }}>
              
              {/* Session Meter */}
              <div style={{ background: '#121214', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>SESSION TELEMETRY</span>
                  <select style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', outline: 'none', fontFamily: 'var(--font-mono)' }} value={playgroundSessionId} onChange={(e) => setPlaygroundSessionId(e.target.value)}>
                    <option value={playgroundSessionId}>{playgroundSessionId}</option>
                    {sessions.filter((s) => s.agent_slug === playgroundAgent && s.external_id !== playgroundSessionId).map((s) => (
                      <option key={s.id} value={s.external_id}>{s.external_id}</option>
                    ))}
                  </select>
                </div>
                {(() => {
                  const currentSession = sessions.find((s) => s.external_id === playgroundSessionId);
                  const limit = currentSession ? currentSession.budget_limit : 2.00;
                  const spent = currentSession ? currentSession.spent : 0;
                  const reserved = currentSession ? currentSession.reserved : 0;
                  const totalUsed = spent + reserved;
                  const rawPercent = limit > 0 ? (totalUsed / limit) * 100 : 0;
                  const meterColor = rawPercent >= 100 ? 'var(--red)' : rawPercent >= 80 ? 'var(--amber)' : 'var(--blue)';

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontSize: '20px', fontWeight: 700, color: '#fff', fontFamily: 'var(--font-mono)' }}>{money(totalUsed)}</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>/ {money(limit)}</span>
                      </div>
                      <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(rawPercent, 100)}%`, background: meterColor, borderRadius: '3px', transition: 'width 0.3s' }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)' }}>
                        <span>Spent: {money(spent)}</span>
                        <span>Reserved: {money(reserved)}</span>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                        <button style={{ flex: 1, background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', color: 'var(--blue)', padding: '6px', borderRadius: '6px', fontSize: '10px', fontWeight: 600 }} onClick={resetCurrentSession}>
                          RESET SPENT TO $0
                        </button>
                        <button style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '6px', borderRadius: '6px', fontSize: '10px', fontWeight: 600 }} onClick={() => {
                          const newSess = `session-${Date.now().toString().slice(-5)}`;
                          setPlaygroundSessionId(newSess);
                          setChatMessages([{ id: `msg-new-sess-${Date.now()}`, role: 'assistant', content: <><Sparkles size={14} style={{ marginRight: "6px", display: "inline" }} /> New active chat session started: {newSess}</>, timestamp: new Date().toLocaleTimeString() }]);
                          setNotice(`NEW SESSION CREATED: ${newSess}`);
                        }}>
                          NEW SESSION
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Agent Meter */}
              <div style={{ background: '#121214', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>AGENT MONTHLY LIMIT</span>
                  <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#fff', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>{playgroundAgent}</span>
                </div>
                {(() => {
                  const currentAgent = adminAgents.find((a) => a.slug === playgroundAgent);
                  const limit = currentAgent ? currentAgent.monthly_budget : 50.00;
                  const spent = currentAgent ? currentAgent.spent : 0;
                  const rawPercent = limit > 0 ? (spent / limit) * 100 : 0;
                  const meterColor = rawPercent >= 100 ? 'var(--red)' : rawPercent >= 80 ? 'var(--amber)' : 'var(--green)';

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontSize: '20px', fontWeight: 700, color: '#fff', fontFamily: 'var(--font-mono)' }}>{money(spent)}</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>/ {money(limit)}</span>
                      </div>
                      <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(rawPercent, 100)}%`, background: meterColor, borderRadius: '3px', transition: 'width 0.3s' }} />
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Last Execution Metric */}
              {lastExecution && (
                <div style={{ background: 'linear-gradient(180deg, rgba(139, 92, 246, 0.1) 0%, rgba(18, 18, 20, 1) 100%)', borderRadius: '16px', border: '1px solid rgba(139, 92, 246, 0.2)', padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--purple)' }}>LAST EXECUTION TRACE</span>
                    <span style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '4px', background: lastExecution.decision === 'BLOCK' ? 'rgba(239,68,68,0.2)' : lastExecution.decision === 'REROUTE' ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.2)', color: lastExecution.decision === 'BLOCK' ? 'var(--red)' : lastExecution.decision === 'REROUTE' ? 'var(--amber)' : 'var(--green)', fontWeight: 700 }}>
                      {lastExecution.decision}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '9px', marginBottom: '2px' }}>LATENCY</div>
                      <div style={{ color: '#fff' }}>{lastExecution.latencyMs} ms</div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '9px', marginBottom: '2px' }}>MODEL</div>
                      <div style={{ color: '#fff' }}>{lastExecution.selectedModel.split('/')[1]}</div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '9px', marginBottom: '2px' }}>ESTIMATED COST</div>
                      <div style={{ color: lastExecution.decision === 'BLOCK' ? 'var(--red)' : '#fff' }}>{lastExecution.decision === 'BLOCK' ? '$0.00 (BLOCKED)' : money(lastExecution.estimatedCost)}</div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '9px', marginBottom: '2px' }}>ACTUAL COST</div>
                      <div style={{ color: '#fff' }}>{lastExecution.decision === 'BLOCK' ? '$0.00' : money(lastExecution.actualCost)}</div>
                    </div>
                  </div>
                  {lastExecution.requestId && (
                    <button style={{ width: '100%', marginTop: '16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '8px', borderRadius: '6px', fontSize: '10px', fontWeight: 600, cursor: 'pointer' }} onClick={() => openRequestDetail(lastExecution.requestId!)}>
                      OPEN FULL AUDIT LEDGER
                    </button>
                  )}
                </div>
              )}

              {/* Session Budget Controls Card */}
              {(() => {
                const currentSession = sessions.find((s) => s.external_id === playgroundSessionId);
                const limit = currentSession ? currentSession.budget_limit : 0;
                const spent = currentSession ? currentSession.spent : 0;
                const pct = limit > 0 ? (spent / limit) * 100 : 0;
                
                return (
                  <div style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(18, 18, 20, 1) 100%)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', padding: '20px', marginTop: '16px' }}>
                    <div style={{ marginBottom: '16px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--purple)' }}>SESSION BUDGET STATUS</span>
                    </div>
                    
                    <div style={{ marginBottom: '20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Consumed Budget</span>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: pct >= 100 ? 'var(--red)' : '#fff' }}>
                          {pct.toFixed(1)}% finished
                        </span>
                      </div>
                      <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: pct >= 100 ? 'var(--red)' : pct > 80 ? 'var(--amber)' : 'var(--purple)', transition: 'width 0.3s ease' }} />
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontFamily: 'var(--font-mono)' }}>OVERRIDE SESSION LIMIT ($)</label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input 
                          type="number" 
                          step="0.0001" 
                          placeholder={limit.toString()}
                          id="playground_limit_input"
                          style={{ flex: 1, background: '#000', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '8px 12px', color: '#fff', fontSize: '12px', outline: 'none' }} 
                        />
                        <button 
                          style={{ background: 'var(--purple)', border: 'none', color: '#fff', padding: '0 16px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                          onMouseOver={(e) => e.currentTarget.style.filter = 'brightness(1.1)'}
                          onMouseOut={(e) => e.currentTarget.style.filter = 'brightness(1)'}
                          onClick={async () => {
                            const inputEl = document.getElementById('playground_limit_input') as HTMLInputElement;
                            const val = inputEl.value;
                            if (!val) return;
                            try {
                              const res = await fetch(`/api/sessions/${playgroundSessionId}/budget`, {
                                method: 'PUT',
                                headers: getAuthHeaders(),
                                body: JSON.stringify({ limit_usd: parseFloat(val) })
                              });
                              if (res.ok) {
                                inputEl.value = '';
                                setNotice(`SESSION ${playgroundSessionId} LIMIT UPDATED TO $${parseFloat(val).toFixed(4)}`);
                                const t = Date.now();
                                fetch(`/api/sessions?t=${t}`, { headers: getAuthHeaders() })
                                  .then((r) => r.json())
                                  .then(setSessions);
                              } else {
                                const err = await res.json().catch(() => ({}));
                                alert(`Error: ${err.detail?.message || 'Failed to update limit'}`);
                              }
                            } catch (e: any) {
                              alert(e.message);
                            }
                          }}
                        >
                          APPLY
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

            </div>
          </div>
        </motion.div>
      )}


      {/* TAB 1: OVERVIEW & ANALYTICS */}
      {activeTab === 'overview' && (
        <motion.div key="overview" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Top Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '8px' }}>
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: '0 0 8px 0' }}>Overview Dashboard</p>
              <h1 style={{ fontSize: '28px', fontWeight: 600, margin: 0, color: '#fff' }}>Welcome to 0xNexigent</h1>
            </div>
            <div>
               <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '6px 12px', borderRadius: '100px', border: '1px solid rgba(255,255,255,0.05)', fontSize: '12px' }}>
                 <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 8px var(--green)' }} />
                 Live Enforcement Active
               </div>
            </div>
          </div>

          {/* Metric Cards (Velogent Style) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            <TiltCard style={{ background: '#121214', borderRadius: '16px', padding: '24px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                <span style={{ fontSize: '13px' }}>Total Spend (30d)</span>
                <BarChart size={16} color="var(--blue)" />
              </div>
              <div>
                <div style={{ fontSize: '32px', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>{money(data.metrics.spent)}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Across all {data.metrics.agents} governed agents</div>
              </div>
            </TiltCard>

            <TiltCard style={{ background: '#121214', borderRadius: '16px', padding: '24px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                <span style={{ fontSize: '13px' }}>Governed Requests</span>
                <CheckCircle size={16} color="var(--green)" />
              </div>
              <div>
                <div style={{ fontSize: '32px', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>{data.metrics.requests.toLocaleString()}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>LLM calls intercepted & routed</div>
              </div>
            </TiltCard>

            <TiltCard style={{ background: '#121214', borderRadius: '16px', padding: '24px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                <span style={{ fontSize: '13px' }}>Warnings Fired (80%)</span>
                <AlertTriangle size={16} color="var(--amber)" />
              </div>
              <div>
                <div style={{ fontSize: '32px', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>{data.metrics.warnings || 0}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Pre-exhaustion slack alerts</div>
              </div>
            </TiltCard>

            <TiltCard style={{ background: '#121214', borderRadius: '16px', padding: '24px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                <span style={{ fontSize: '13px' }}>Hard Blocks (100%)</span>
                <ShieldAlert size={16} color="var(--red)" />
              </div>
              <div>
                <div style={{ fontSize: '32px', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>{data.metrics.blocks || 0}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Requests blocked pre-execution</div>
              </div>
            </TiltCard>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '24px' }}>
            
            {/* Left Column: Chart & Budgets */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Velogent Style Chart Panel */}
              <div style={{ background: '#121214', borderRadius: '16px', padding: '24px', border: '1px solid rgba(255,255,255,0.05)', flex: 1, minHeight: '300px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ marginBottom: '24px' }}>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 600 }}>Budget Utilization Trend</h3>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>Cumulative spend across all scopes over the last 30 days</p>
                </div>
                <div style={{ flex: 1, position: 'relative', borderLeft: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)', margin: '0 10px 10px 20px' }}>
                  {(() => {
                    const totalLimit = data.budgets.reduce((sum, b) => b.scope === 'team' ? sum + b.limit : sum, 0) || 500;
                    const spent = data.metrics.spent;
                    const reserved = data.metrics.reserved;
                    
                    // Normalize to 0-80 scale (leave 20px padding at top)
                    const normalizedSpent = Math.min((spent / totalLimit) * 80, 80);
                    const normalizedReserved = Math.min(((spent + reserved) / totalLimit) * 80, 80);
                    
                    // Y goes from 0 (top) to 100 (bottom).
                    const spentEndY = 95 - normalizedSpent;
                    const spentStartY = Math.min(95, spentEndY + 30); // Start lower
                    const spentMidY = (spentStartY + spentEndY) / 2 + 5;
                    
                    const resEndY = 95 - normalizedReserved;
                    const resStartY = Math.min(95, resEndY + 30);
                    const resMidY = (resStartY + resEndY) / 2 + 5;
                    
                    const spentPathD = `M 0 ${spentStartY} Q 40 ${spentMidY} 70 ${spentEndY + 5} T 100 ${spentEndY}`;
                    const resPathD = `M 0 ${resStartY} Q 40 ${resMidY} 70 ${resEndY + 5} T 100 ${resEndY}`;
                    
                    return (
                      <svg style={{ position: 'absolute', width: '100%', height: '100%', overflow: 'visible' }} preserveAspectRatio="none" viewBox="0 0 100 100">
                        <defs>
                          <linearGradient id="chartBlue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--blue)" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="var(--blue)" stopOpacity="0" />
                          </linearGradient>
                          <linearGradient id="chartPurple" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--purple)" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="var(--purple)" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        
                        {/* Reserved Area (Purple) */}
                        <path d={`${resPathD} L 100 100 L 0 100 Z`} fill="url(#chartPurple)" />
                        <path d={resPathD} stroke="var(--purple)" strokeWidth="1.5" fill="none" vectorEffect="non-scaling-stroke" />
                        
                        {/* Spent Area (Blue) */}
                        <path d={`${spentPathD} L 100 100 L 0 100 Z`} fill="url(#chartBlue)" />
                        <path d={spentPathD} stroke="var(--blue)" strokeWidth="1.5" fill="none" vectorEffect="non-scaling-stroke" />
                      </svg>
                    );
                  })()}
                  {(() => {
                    const getPastDateString = (daysAgo: number) => {
                      const d = new Date();
                      d.setDate(d.getDate() - daysAgo);
                      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    };
                    return (
                      <>
                        <span style={{ position: 'absolute', bottom: '-20px', left: '0', fontSize: '10px', color: 'var(--text-muted)' }}>{getPastDateString(28)}</span>
                        <span style={{ position: 'absolute', bottom: '-20px', left: '25%', fontSize: '10px', color: 'var(--text-muted)' }}>{getPastDateString(21)}</span>
                        <span style={{ position: 'absolute', bottom: '-20px', left: '50%', fontSize: '10px', color: 'var(--text-muted)' }}>{getPastDateString(14)}</span>
                        <span style={{ position: 'absolute', bottom: '-20px', left: '75%', fontSize: '10px', color: 'var(--text-muted)' }}>{getPastDateString(7)}</span>
                        <span style={{ position: 'absolute', bottom: '-20px', right: '0', fontSize: '10px', color: 'var(--text-muted)' }}>Today</span>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Budget Progress Rows */}
              <div style={{ background: '#121214', borderRadius: '16px', padding: '24px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 600 }}>Active Budgets Overview</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {data.budgets.slice(0, 5).map((b) => {
                    const st = state(b.percent);
                    return (
                      <div key={b.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600 }}>
                            <span style={{ color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '11px', marginRight: '8px' }}>[{b.scope}]</span>
                            {b.id}
                          </span>
                          <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)' }}>{money(b.spent)} <span style={{ color: 'var(--text-muted)' }}>/ {money(b.limit)}</span></span>
                        </div>
                        <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.min(b.percent, 100)}%`, background: `var(--${st})`, borderRadius: '2px', transition: 'width 0.5s ease' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                          <span>{displayPercent(b.spent, b.limit)} CONSUMED</span>
                          <span style={{ color: `var(--${st})` }}>{b.percent >= 100 ? 'HARD BLOCK ACTIVE' : b.percent >= 80 ? 'WARNING THRESHOLD' : 'HEALTHY'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              
            </div>

            {/* Right Column: Actions & Ledger */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Prove Enforcement Live Buttons */}
              <div style={{ background: '#121214', borderRadius: '16px', padding: '24px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 600 }}>Policy Test Scenarios</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button className="secondary" style={{ width: '100%', justifyContent: 'space-between', padding: '12px' }} disabled={!!running} onClick={() => runScenario('reroute')}>
                    <span><span style={{ color: 'var(--amber)', marginRight: '8px' }}>●</span> Model Reroute</span>
                    {running === 'reroute' ? <RefreshCw size={14} className="spin" /> : <Play size={14} />}
                  </button>
                  <button className="secondary" style={{ width: '100%', justifyContent: 'space-between', padding: '12px' }} disabled={!!running} onClick={() => runScenario('warning')}>
                    <span><span style={{ color: 'var(--amber)', marginRight: '8px' }}>●</span> 80% Warning</span>
                    {running === 'warning' ? <RefreshCw size={14} className="spin" /> : <Play size={14} />}
                  </button>
                  <button className="secondary" style={{ width: '100%', justifyContent: 'space-between', padding: '12px' }} disabled={!!running} onClick={() => runScenario('block')}>
                    <span><span style={{ color: 'var(--red)', marginRight: '8px' }}>●</span> Hard Block</span>
                    {running === 'block' ? <RefreshCw size={14} className="spin" /> : <Play size={14} />}
                  </button>
                  <button className="secondary" style={{ width: '100%', justifyContent: 'space-between', padding: '12px' }} disabled={!!running} onClick={() => runScenario('runaway')}>
                    <span><span style={{ color: 'var(--red)', marginRight: '8px' }}>●</span> Circuit Breaker</span>
                    {running === 'runaway' ? <RefreshCw size={14} className="spin" /> : <Play size={14} />}
                  </button>
                </div>
              </div>

              {/* Execution Ledger Minimap */}
              <div style={{ background: '#121214', borderRadius: '16px', padding: '24px', border: '1px solid rgba(255,255,255,0.05)', flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Recent Ledger</h3>
                  <button style={{ background: 'none', border: 'none', color: 'var(--blue)', fontSize: '12px', padding: 0 }} onClick={() => setActiveTab('audit')}>View All →</button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
                  {data.requests.slice(0, 8).map((r) => (
                    <div key={r.id} onClick={() => openRequestDetail(r.id)} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                      <div>
                        <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)' }}>{r.requested}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{new Date(r.created_at).toLocaleString()}</div>
                      </div>
                      <span className={`pill ${ r.decision === 'BLOCK' || r.decision === 'PAUSE' ? 'red' : r.decision === 'REROUTE' ? 'amber' : 'green' }`} style={{ fontSize: '9px', padding: '2px 6px' }}>
                        {r.decision}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
        </motion.div>
      )}

      {/* TAB 2: FLEET & BUDGET CONTROL */}
      {activeTab === 'fleet' && (
        <motion.div key="fleet" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Top Header & 3-Tier Overview */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: '0 0 8px 0' }}>Fleet & Budget Control</p>
              <h1 style={{ fontSize: '28px', fontWeight: 600, margin: 0, color: '#fff' }}>Agent Budgets</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '8px' }}>Manage 3-Tier budgets (Team, Agent, Session) with pre-execution blocking.</p>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ background: '#121214', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '10px 16px', textAlign: 'center' }}>
                 <div style={{ fontSize: '10px', color: 'var(--purple)', fontWeight: 600, marginBottom: '4px' }}>TEAM TIER</div>
                 <div style={{ fontSize: '14px', fontWeight: 700 }}>$500/mo</div>
              </div>
              <div style={{ background: '#121214', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '10px 16px', textAlign: 'center' }}>
                 <div style={{ fontSize: '10px', color: 'var(--green)', fontWeight: 600, marginBottom: '4px' }}>AGENT TIER</div>
                 <div style={{ fontSize: '14px', fontWeight: 700 }}>$50/mo</div>
              </div>
              <div style={{ background: '#121214', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '10px 16px', textAlign: 'center' }}>
                 <div style={{ fontSize: '10px', color: 'var(--amber)', fontWeight: 600, marginBottom: '4px' }}>SESSION TIER</div>
                 <div style={{ fontSize: '14px', fontWeight: 700 }}>$2/session</div>
              </div>
              <button
                className="secondary"
                style={{ background: 'var(--purple-glow)', borderColor: 'var(--purple)', color: '#fff', padding: '0 16px', fontSize: '12px', fontWeight: 600, borderRadius: '8px' }}
                onClick={applyEnterprise3TierDefaults}
              >
                <RefreshCw size={14} style={{ marginRight: "6px", display: "inline" }} /> RESET DEFAULTS
              </button>
            </div>
          </div>

          <div style={{ background: '#121214', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
            {/* Search / Filter Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center' }}>
              <div style={{ position: 'relative', width: '300px' }}>
                <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input type="text" placeholder="Search agents..." style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px 8px 36px', borderRadius: '8px', color: '#fff', fontSize: '13px' }} />
              </div>
            </div>

            {/* Table Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr 2fr 1fr', gap: '16px', padding: '12px 24px', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div>NAME</div>
              <div>STATUS</div>
              <div>TEAM (TIER 1)</div>
              <div>AGENT BUDGET (TIER 2)</div>
              <div style={{ textAlign: 'right' }}>ACTIONS</div>
            </div>

            {/* Table Body */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {adminTeams.map((t) => {
                const teamAgents = adminAgents.filter((a) => a.team_id === t.id);
                const teamBudgetObj = data.budgets.find((b) => b.scope === 'team' && b.id === t.id);
                const teamSpent = t.spent || (teamBudgetObj ? teamBudgetObj.spent : 0);
                const teamLimit = t.limit || (teamBudgetObj ? teamBudgetObj.limit : 500);

                return teamAgents.map((ag, index) => {
                  const agentBudget = data.budgets.find((b) => b.scope === 'agent' && b.id === ag.id);
                  const agSpent = ag.spent || (agentBudget ? agentBudget.spent : 0);
                  const agLimit = ag.monthly_budget || (agentBudget ? agentBudget.limit : 50);
                  const isEditing = editingAgentSlug === ag.slug;
                  const st = state((agSpent / (agLimit || 1)) * 100);

                  return (
                    <div key={ag.slug} style={{ display: 'flex', flexDirection: 'column', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr 2fr 1fr', gap: '16px', padding: '16px 24px', alignItems: 'center', background: 'transparent', transition: 'background 0.2s' }} className="hover-row">
                        
                        {/* Name Column */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Building size={16} color="var(--purple)" />
                          </div>
                          <div>
                            <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>{ag.name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{ag.slug}</div>
                          </div>
                        </div>

                        {/* Status Column */}
                        <div>
                          <span className={`pill ${ag.status === 'PAUSED' ? 'amber' : 'green'}`} style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '100px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            {ag.status === 'PAUSED' ? <Square size={10} /> : <Check size={10} />}
                            {ag.status === 'PAUSED' ? 'Paused' : 'Active'}
                          </span>
                        </div>

                        {/* Team Column */}
                        <div>
                          <span style={{ fontSize: '12px', color: 'var(--blue)', background: 'rgba(59, 130, 246, 0.1)', padding: '4px 8px', borderRadius: '6px' }}>
                            {t.product}
                          </span>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>Team Spend: {money(teamSpent)} / {money(teamLimit)}</div>
                        </div>

                        {/* Budget Progress Column */}
                        <div style={{ paddingRight: '24px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                            <span style={{ color: 'var(--text-muted)' }}>{displayPercent(agSpent, agLimit)} consumed</span>
                            <span style={{ fontFamily: 'var(--font-mono)' }}>{money(agSpent)} / {money(agLimit)}</span>
                          </div>
                          <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${Math.min((agSpent / (agLimit || 1)) * 100, 100)}%`, background: `var(--${st})`, borderRadius: '2px' }} />
                          </div>
                        </div>

                        {/* Actions Column */}
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', padding: '6px', borderRadius: '6px', color: '#fff', cursor: 'pointer' }} onClick={() => {
                            if (isEditing) {
                              setEditingAgentSlug(null);
                            } else {
                              setEditingAgentSlug(ag.slug);
                              setEditAgentMonthlyVal(agLimit.toString());
                              setEditAgentSessionVal((ag.default_session_budget || 2.0).toString());
                            }
                          }}>
                            <Settings size={14} />
                          </button>
                          <button style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', padding: '6px', borderRadius: '6px', color: ag.status === 'PAUSED' ? 'var(--green)' : 'var(--red)', cursor: 'pointer' }} onClick={() => handleToggleAgentStatus(ag.slug, ag.status)}>
                            {ag.status === 'PAUSED' ? <Play size={14} /> : <Square size={14} />}
                          </button>
                        </div>

                      </div>

                      {/* Expandable Edit Form */}
                      {isEditing && (
                        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.02)' }}>
                           <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', color: 'var(--purple)' }}>Edit {ag.name} Budget Limits</h4>
                           <div style={{ display: 'flex', gap: '16px' }}>
                             <div style={{ flex: 1 }}>
                               <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>AGENT MONTHLY BUDGET (TIER 2)</label>
                               <input type="number" step="0.01" style={{ width: '100%', padding: '8px', background: '#000', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff' }} value={editAgentMonthlyVal} onChange={(e) => setEditAgentMonthlyVal(e.target.value)} />
                             </div>
                             <div style={{ flex: 1 }}>
                               <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>AGENT SESSION LIMIT (TIER 3)</label>
                               <input type="number" step="0.01" style={{ width: '100%', padding: '8px', background: '#000', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff' }} value={editAgentSessionVal} onChange={(e) => setEditAgentSessionVal(e.target.value)} />
                             </div>
                             <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                               <button style={{ padding: '8px 16px', background: 'var(--purple)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }} onClick={() => {
                                 handleUpdateAgentBudget(ag.slug, parseFloat(editAgentMonthlyVal), parseFloat(editAgentSessionVal));
                                 setEditingAgentSlug(null);
                               }}>
                                 SAVE CHANGES
                               </button>
                             </div>
                           </div>
                        </div>
                      )}
                    </div>
                  );
                });
              })}
            </div>
          </div>
        </div>
        </motion.div>
      )}

      {/* TAB 3: AUDIT & TRACE LOGS */}
      {activeTab === 'audit' && (
        <motion.div key="audit" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', height: 'calc(100vh - 120px)' }}>
          {/* Top Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: '0 0 8px 0' }}>Audit & Trace Logs</p>
              <h1 style={{ fontSize: '28px', fontWeight: 600, margin: 0, color: '#fff' }}>Governance Console</h1>
            </div>
            <div style={{ display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '6px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
              {['ALL', 'ACTIVE', 'EXHAUSTED', 'CLOSED'].map((st) => (
                <button key={st} className={sessionFilterStatus === st ? '' : 'secondary'} style={{ padding: '6px 12px', fontSize: '11px', background: sessionFilterStatus === st ? 'var(--blue)' : 'transparent', color: sessionFilterStatus === st ? '#fff' : 'var(--text-muted)', border: 'none' }} onClick={() => setSessionFilterStatus(st)}>
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Split Pane Layout */}
          <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: '24px', flex: 1, minHeight: 0 }}>
            
            {/* Left Pane: HITL Queue (Audit Logs) */}
            <div style={{ background: '#121214', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input type="text" placeholder="Search audit queue..." style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px 8px 36px', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginTop: '16px', fontWeight: 600 }}>
                  <span>LATEST LLM REQUESTS</span>
                  <span>{data.requests.length} ITEMS</span>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {data.requests.map((r) => {
                    const isBlock = r.decision === 'BLOCK' || r.decision === 'PAUSE';
                    const isReroute = r.decision === 'REROUTE';
                    const color = isBlock ? 'var(--red)' : isReroute ? 'var(--amber)' : 'var(--green)';
                    return (
                      <div key={r.id} onClick={() => openRequestDetail(r.id)} style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', borderLeft: `3px solid ${color}`, cursor: 'pointer', transition: 'background 0.2s' }} className="hover-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: '#fff' }}>{r.requested}</span>
                          <span style={{ fontSize: '10px', color: color, fontWeight: 700 }}>{r.decision}</span>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                          {r.selected ? `Routed to: ${r.selected}` : 'Execution blocked pre-flight'}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', color: 'var(--text-muted)' }}>
                          <span style={{ fontFamily: 'var(--font-mono)' }}>{new Date(r.created_at).toLocaleString()}</span>
                          <span style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>{money(r.actual)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Pane: Sessions & Incidents */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto', paddingRight: '8px' }}>
              
              {/* Incidents (Circuit Breakers) */}
              <div style={{ background: '#121214', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', padding: '24px' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldAlert size={16} color="var(--red)" /> Critical Circuit Breaker Incidents
                </h3>
                {incidents.length === 0 ? (
                  <div style={{ padding: '32px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', color: 'var(--text-muted)', fontSize: '13px' }}>
                    <CheckCircle size={24} color="var(--green)" style={{ margin: '0 auto 12px auto', display: 'block' }} />
                    No historical circuit breaker incidents recorded. Fleet operating safely.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {incidents.map((inc) => (
                      <div key={inc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'rgba(255,0,0,0.05)', border: '1px solid rgba(255,0,0,0.2)', borderRadius: '12px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span style={{ color: 'var(--red)', fontSize: '12px', fontWeight: 700 }}>{inc.severity}</span>
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{new Date(inc.created_at).toLocaleString()}</span>
                          </div>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>Agent {inc.agent_slug} triggered {inc.kind}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                          <span className={`pill ${inc.status === 'RESOLVED' ? 'green' : inc.status === 'ACKNOWLEDGED' ? 'amber' : 'red'}`} style={{ fontSize: '10px' }}>
                            {inc.status}
                          </span>
                          <button style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '6px', color: '#fff', fontSize: '11px', cursor: 'pointer' }} onClick={() => openIncidentDetail(inc.id)}>
                            REVIEW
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sessions List */}
              <div style={{ background: '#121214', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', padding: '24px', flex: 1 }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 600 }}>Active Session Lifecycles</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                  {filteredSessions.map((s) => (
                    <div key={s.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{s.external_id}</div>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff', marginTop: '2px' }}>{s.agent_name}</div>
                        </div>
                        <span className={`pill ${s.status === 'EXHAUSTED' ? 'red' : s.status === 'CLOSED' ? 'amber' : 'green'}`} style={{ fontSize: '10px', padding: '2px 8px' }}>
                          {s.status}
                        </span>
                      </div>
                      
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Session Budget</span>
                          <span style={{ fontFamily: 'var(--font-mono)' }}>{money(s.spent)} / {money(s.budget_limit)}</span>
                        </div>
                        <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.min((s.spent / s.budget_limit) * 100, 100)}%`, background: s.status === 'EXHAUSTED' ? 'var(--red)' : 'var(--blue)', borderRadius: '2px' }} />
                        </div>
                      </div>

                      {s.status === 'ACTIVE' && (
                        <button style={{ background: 'rgba(255,255,255,0.05)', border: 'none', padding: '8px', borderRadius: '6px', color: '#fff', fontSize: '11px', fontWeight: 600, cursor: 'pointer', marginTop: '4px' }} onClick={() => closeSession(s.external_id)}>
                          CLOSE SESSION
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
        </motion.div>
      )}

      {/* TAB 4: ADMIN CONFIG & KEYS */}
      {activeTab === 'admin' && (
        <motion.div key="admin" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }} style={{ display: 'flex', flexDirection: 'column', gap: '32px', paddingBottom: '40px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
            <div>
              <p style={{ color: 'var(--purple)', fontSize: '12px', margin: '0 0 8px 0', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>&gt; nx_gateway config --admin</p>
              <h1 style={{ fontSize: '28px', fontWeight: 600, margin: 0, color: '#fff' }}>Gateway Configuration</h1>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '32px' }}>
            
            {/* TEAM MANAGEMENT */}
            <section style={{ background: '#121214', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
              <div style={{ padding: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 600, margin: 0, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Enterprise Team Management
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '8px 0 0 0' }}>Configure global budget limits and products per engineering team.</p>
                </div>
                <button style={{ background: 'var(--blue)', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => setShowTeamModal(true)}>
                  <Play size={14} /> PROVISION TEAM
                </button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      <th style={{ padding: '16px 24px', fontWeight: 600 }}>TEAM NAME</th>
                      <th style={{ padding: '16px', fontWeight: 600 }}>PRODUCT</th>
                      <th style={{ padding: '16px', fontWeight: 600 }}>MONTHLY LIMIT</th>
                      <th style={{ padding: '16px', fontWeight: 600 }}>SPENT</th>
                      <th style={{ padding: '16px', fontWeight: 600 }}>RESERVED</th>
                      <th style={{ padding: '16px', fontWeight: 600, width: '200px' }}>UTILISATION</th>
                      <th style={{ padding: '16px 24px', fontWeight: 600, textAlign: 'right' }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminTeams.map((t) => (
                      <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', fontSize: '13px' }} className="hover-card">
                        <td style={{ padding: '16px 24px', color: '#fff', fontWeight: 600 }}>{t.name}</td>
                        <td style={{ padding: '16px', color: 'var(--text-muted)' }}>{t.product}</td>
                        <td style={{ padding: '16px', fontFamily: 'var(--font-mono)' }}>
                          {editingTeamId === t.id ? (
                            <input type="number" step="0.01" style={{ width: '80px', padding: '4px 8px', background: 'rgba(0,0,0,0.5)', border: '1px solid var(--blue)', color: '#fff', borderRadius: '4px', fontFamily: 'var(--font-mono)', fontSize: '12px' }} value={editLimitVal} onChange={(e) => setEditLimitVal(e.target.value)} />
                          ) : (
                            <span style={{ color: '#fff' }}>{money(t.limit)}</span>
                          )}
                        </td>
                        <td style={{ padding: '16px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{money(t.spent)}</td>
                        <td style={{ padding: '16px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{money(t.reserved)}</td>
                        <td style={{ padding: '16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${Math.min(t.percent, 100)}%`, background: `var(--${state(t.percent)})`, borderRadius: '2px' }} />
                            </div>
                            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: `var(--${state(t.percent)})`, fontWeight: 600, width: '40px', textAlign: 'right' }}>{Math.round(t.percent)}%</span>
                          </div>
                        </td>
                        <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                          {editingTeamId === t.id ? (
                            <button style={{ padding: '6px 12px', fontSize: '10px', background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }} onClick={() => handleUpdateTeamBudget(t.id, parseFloat(editLimitVal))}>SAVE</button>
                          ) : (
                            <button style={{ padding: '6px 12px', fontSize: '10px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }} onClick={() => { setEditingTeamId(t.id); setEditLimitVal(t.limit.toString()); }}>EDIT LIMIT</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* AGENT MANAGEMENT & KEYS */}
            <section style={{ background: '#121214', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
              <div style={{ padding: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 600, margin: 0, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Agent Provisioning & API Keys
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '8px 0 0 0' }}>Manage AI agent credentials, routing access, and key rotation.</p>
                </div>
                <button style={{ background: 'var(--purple)', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => setShowAgentModal(true)}>
                  <Play size={14} /> PROVISION AGENT KEY
                </button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      <th style={{ padding: '16px 24px', fontWeight: 600 }}>AGENT SLUG</th>
                      <th style={{ padding: '16px', fontWeight: 600 }}>NAME</th>
                      <th style={{ padding: '16px', fontWeight: 600 }}>TEAM</th>
                      <th style={{ padding: '16px', fontWeight: 600 }}>KEY PREFIX</th>
                      <th style={{ padding: '16px', fontWeight: 600 }}>MONTHLY LIMIT</th>
                      <th style={{ padding: '16px', fontWeight: 600 }}>STATUS</th>
                      <th style={{ padding: '16px 24px', fontWeight: 600, textAlign: 'right' }}>KEY ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminAgents.map((a) => (
                      <tr key={a.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', fontSize: '13px' }} className="hover-card">
                        <td style={{ padding: '16px 24px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{a.slug}</td>
                        <td style={{ padding: '16px', color: '#fff', fontWeight: 600 }}>{a.name}</td>
                        <td style={{ padding: '16px', color: 'var(--text-muted)' }}>{a.team_name}</td>
                        <td style={{ padding: '16px', fontFamily: 'var(--font-mono)', color: 'var(--purple)' }}>{a.key_prefix}</td>
                        <td style={{ padding: '16px', fontFamily: 'var(--font-mono)', color: '#fff' }}>{money(a.monthly_budget)}</td>
                        <td style={{ padding: '16px' }}>
                          <span style={{ fontSize: '10px', fontWeight: 700, padding: '4px 8px', borderRadius: '4px', background: a.status === 'PAUSED' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', color: a.status === 'PAUSED' ? 'var(--red)' : 'var(--green)' }}>
                            {a.status}
                          </span>
                        </td>
                        <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button style={{ padding: '6px 12px', fontSize: '10px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }} onClick={() => handleRotateKey(a.slug)}>ROTATE</button>
                            <button style={{ padding: '6px 12px', fontSize: '10px', background: 'rgba(239,68,68,0.1)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }} onClick={() => handleRevokeKey(a.slug)}>REVOKE</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
              {/* WEBHOOKS */}
              <section style={{ background: '#121214', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                <div style={{ padding: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0, color: '#fff' }}>Webhook Integrations</h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '8px 0 0 0' }}>Async event dispatch (Slack/PagerDuty).</p>
                  </div>
                  <button style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '6px', fontSize: '10px', fontWeight: 600, cursor: 'pointer' }} onClick={() => setShowWebhookModal(true)}>
                    + ADD ENDPOINT
                  </button>
                </div>
                {webhooks.length === 0 ? (
                  <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                    No integrations configured.
                  </div>
                ) : (
                  <div style={{ padding: '16px' }}>
                    {webhooks.map((w) => (
                      <div key={w.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', marginBottom: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div>
                          <div style={{ color: '#fff', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>{w.name}</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>{w.url}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '4px', background: w.has_secret ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)', color: w.has_secret ? 'var(--green)' : 'var(--amber)', fontWeight: 600 }}>
                            {w.has_secret ? 'HMAC' : 'NO AUTH'}
                          </span>
                          <button style={{ padding: '6px 10px', fontSize: '10px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', cursor: 'pointer' }} onClick={() => testWebhook(w.id)}>TEST</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* MODEL POLICY COMPARISON */}
              <section style={{ background: '#121214', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                <div style={{ padding: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0, color: '#fff' }}>Supported Model Routing Hierarchy</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '8px 0 0 0' }}>Cost limits trigger automatic fallbacks to preserve budget.</p>
                </div>
                <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  
                  <div style={{ padding: '16px', background: 'rgba(139,92,246,0.05)', borderRadius: '12px', borderLeft: '3px solid var(--purple)' }}>
                    <div style={{ fontSize: '10px', color: 'var(--purple)', fontWeight: 700, marginBottom: '8px' }}>PRIMARY REASONING ENGINE</div>
                    <div style={{ fontSize: '14px', color: '#fff', fontWeight: 600, marginBottom: '4px' }}>GPT OSS 120B</div>
                    <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: '12px' }}>openai/gpt-oss-120b</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      In: <strong style={{ color: '#fff' }}>$0.15 / M</strong> | Out: <strong style={{ color: '#fff' }}>$0.60 / M</strong>
                    </div>
                  </div>

                  <div style={{ padding: '16px', background: 'rgba(245,158,11,0.05)', borderRadius: '12px', borderLeft: '3px solid var(--amber)' }}>
                    <div style={{ fontSize: '10px', color: 'var(--amber)', fontWeight: 700, marginBottom: '8px' }}>ECONOMY FALLBACK MODEL</div>
                    <div style={{ fontSize: '14px', color: '#fff', fontWeight: 600, marginBottom: '4px' }}>GPT OSS 20B</div>
                    <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: '12px' }}>openai/gpt-oss-20b</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      In: <strong style={{ color: '#fff' }}>$0.075 / M</strong> | Out: <strong style={{ color: '#fff' }}>$0.30 / M</strong>
                    </div>
                  </div>

                </div>
              </section>
            </div>

          </div>
        </motion.div>
      )}

      {activeTab === 'docs' && <DocsTab />}

      </AnimatePresence>

      {/* INSPECT AGENT DETAIL MODAL */}
      {selectedAgentDetail && (
        <div className="modal-overlay" onClick={() => setSelectedAgentDetail(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '680px' }}>
            <div className="modal-header">
              <div>
                <p className="tag">&lt; FLEET AGENT DEEP INSPECTION &gt;</p>
                <h2>{selectedAgentDetail.name}</h2>
              </div>
              <button className="modal-close" onClick={() => setSelectedAgentDetail(null)}>
                <X size={14} style={{ display: "inline" }} /> CLOSE
              </button>
            </div>

            <div className="audit-grid">
              <div className="audit-field">
                <label>AGENT SLUG</label>
                <span><code>{selectedAgentDetail.slug}</code></span>
              </div>
              <div className="audit-field">
                <label>TEAM</label>
                <span>{selectedAgentDetail.team_name}</span>
              </div>
              <div className="audit-field">
                <label>KEY PREFIX</label>
                <span className="purple"><code>{selectedAgentDetail.key_prefix}</code></span>
              </div>
              <div className="audit-field">
                <label>STATUS</label>
                <span className={`pill ${selectedAgentDetail.status === 'PAUSED' ? 'red' : 'green'}`}>● {selectedAgentDetail.status}</span>
              </div>
              <div className="audit-field">
                <label>PREFERRED MODEL</label>
                <span>{selectedAgentDetail.preferred_model}</span>
              </div>
              <div className="audit-field">
                <label>FALLBACK MODEL</label>
                <span>{selectedAgentDetail.fallback_model || 'NONE'}</span>
              </div>
              <div className="audit-field">
                <label>MONTHLY BUDGET LIMIT</label>
                <span>{money(selectedAgentDetail.monthly_budget)}</span>
              </div>
              <div className="audit-field">
                <label>DEFAULT SESSION BUDGET</label>
                <span>{money(selectedAgentDetail.default_session_budget || 2.0)}</span>
              </div>
              <div className="audit-field">
                <label>CONSUMED MONTHLY SPEND</label>
                <span className="green">{money(selectedAgentDetail.spent)}</span>
              </div>
              <div className="audit-field">
                <label>HOURLY BURN RATE</label>
                <span>{money(selectedAgentDetail.hourly_burn || 0)}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button
                className={selectedAgentDetail.status === 'PAUSED' ? '' : 'danger'}
                onClick={() => {
                  handleToggleAgentStatus(selectedAgentDetail.slug, selectedAgentDetail.status);
                  setSelectedAgentDetail(null);
                }}
              >
                {selectedAgentDetail.status === 'PAUSED' ? <>ACTIVATE AGENT <Play size={14} style={{ marginLeft: "6px", display: "inline" }} /></> : <>PAUSE AGENT <Square size={14} style={{ marginLeft: "6px", display: "inline" }} /></>}
              </button>
              <button
                className="secondary"
                onClick={() => {
                  handleRotateKey(selectedAgentDetail.slug);
                }}
              >
                ROTATE GATEWAY KEY <Key size={14} style={{ marginRight: "6px" }} />
              </button>
              <button
                className="secondary"
                onClick={() => {
                  setEditingAgentSlug(selectedAgentDetail.slug);
                  setEditAgentMonthlyVal(selectedAgentDetail.monthly_budget.toString());
                  setEditAgentSessionVal((selectedAgentDetail.default_session_budget || 2.0).toString());
                  setSelectedAgentDetail(null);
                }}
              >
                EDIT BUDGET TIERS <Settings size={14} style={{ marginLeft: "6px", display: "inline" }} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WEBHOOK CREATION MODAL */}
      {showWebhookModal && (
        <div className="modal-overlay" onClick={() => setShowWebhookModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <div>
                <p className="tag">&lt; WEBHOOK CONFIGURATION &gt;</p>
                <h2>Configure Webhook Endpoint</h2>
              </div>
              <button className="modal-close" onClick={() => setShowWebhookModal(false)}>
                <X size={14} style={{ display: "inline" }} />
              </button>
            </div>
            <form onSubmit={handleCreateWebhook}>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label>INTEGRATION NAME</label>
                <input required placeholder="e.g. Slack Incident Channel" value={webhookName} onChange={(e) => setWebhookName(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label>TARGET URL</label>
                <input required placeholder="https://hooks.slack.com/services/..." value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label>HMAC SECRET KEY (OPTIONAL)</label>
                <input placeholder="e.g. whsec_..." value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} />
              </div>
              <button type="submit" style={{ width: '100%' }}>
                SAVE WEBHOOK <Play size={14} style={{ marginLeft: "6px", display: "inline" }} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* INCIDENT DETAIL MODAL */}
      {selectedIncidentId && incidentDetail && (
        <div className="modal-overlay" onClick={() => setSelectedIncidentId(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '680px' }}>
            <div className="modal-header">
              <div>
                <p className="tag" style={{ color: 'var(--red)' }}>&lt; INCIDENT INVESTIGATION & HUMAN REVIEW &gt;</p>
                <h2>Runaway Agent Circuit Breaker</h2>
              </div>
              <button className="modal-close" onClick={() => setSelectedIncidentId(null)}>
                <X size={14} style={{ display: "inline" }} /> CLOSE
              </button>
            </div>

            <div className="audit-grid">
              <div className="audit-field">
                <label>AGENT</label>
                <span>{incidentDetail.agent?.name} (<code>{incidentDetail.agent?.slug}</code>)</span>
              </div>
              <div className="audit-field">
                <label>TEAM</label>
                <span>{incidentDetail.team?.name || '—'}</span>
              </div>
              <div className="audit-field">
                <label>ROLLING 1-HR SPEND</label>
                <span className="red">{money(incidentDetail.hourly_spend)}</span>
              </div>
              <div className="audit-field">
                <label>MONTHLY BUDGET LIMIT</label>
                <span>{money(incidentDetail.monthly_limit)}</span>
              </div>
              <div className="audit-field" style={{ gridColumn: 'span 2' }}>
                <label>CIRCUIT BREAKER STATUS</label>
                <span className={incidentDetail.percent_consumed >= 20 ? 'red' : 'green'}>
                  {incidentDetail.percent_consumed}% OF MONTHLY LIMIT CONSUMED IN 1 HOUR (LIMIT: 20%)
                </span>
              </div>
            </div>

            <h3>Human-in-the-Loop Actions</h3>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '16px 0' }}>
              {incidentDetail.status === 'OPEN' && (
                <button className="warning" onClick={() => handleIncidentAction('acknowledge')}>
                  ACKNOWLEDGE INCIDENT
                </button>
              )}
              <button onClick={() => handleIncidentAction('resolve')}>
                RESOLVE & RESUME AGENT <Play size={14} style={{ marginLeft: "6px", display: "inline" }} />
              </button>
              <button className="secondary" onClick={() => handleIncidentAction('keep-paused')}>
                KEEP PAUSED
              </button>
              <button className="danger" onClick={() => handleIncidentAction('revoke-agent-key')}>
                REVOKE GATEWAY KEY <Square size={14} style={{ marginLeft: "6px", display: "inline" }} />
              </button>
            </div>

            <h3 style={{ marginTop: '20px' }}>Evidence Request Stream</h3>
            <div className="table" style={{ marginTop: '10px' }}>
              <div className="row header" style={{ gridTemplateColumns: '120px 2fr 100px 100px' }}>
                <span>TIME</span>
                <span>MODELS</span>
                <span>DECISION</span>
                <span>COST</span>
              </div>
              {incidentDetail.recent_requests.map((r) => (
                <div className="row" key={r.id} style={{ gridTemplateColumns: '120px 2fr 100px 100px', cursor: 'default' }}>
                  <span>{new Date(r.created_at).toLocaleString()}</span>
                  <span><code>{r.requested_model} → {r.selected_model || '—'}</code></span>
                  <span className={`pill ${r.decision === 'BLOCK' ? 'red' : r.decision === 'REROUTE' ? 'amber' : 'green'}`}>{r.decision}</span>
                  <span>{money(r.actual_cost)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* RAW KEY ISSUED MODAL */}
      {issuedKey && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ borderColor: 'var(--green)' }}>
            <div className="modal-header">
              <div>
                <p className="tag" style={{ color: 'var(--green)' }}>
                  &lt; GATEWAY KEY ISSUED / SAVE IMMEDIATELY &gt;
                </p>
                <h2>0xNexigent Agent Key Generated</h2>
              </div>
              <button className="modal-close" onClick={() => setIssuedKey(null)}>
                <X size={14} style={{ display: "inline" }} /> CLOSE
              </button>
            </div>
            <p style={{ color: '#ccc', fontSize: '13px' }}>
              This raw key is displayed <strong>ONCE</strong>. Store it securely in your agent runtime environment variables.
            </p>

            <div className="key-display">
              <code>{issuedKey.raw_key}</code>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(issuedKey.raw_key);
                  setNotice('KEY COPIED TO CLIPBOARD');
                }}
              >
                COPY KEY TO CLIPBOARD <Copy size={14} style={{ marginLeft: "6px", display: "inline" }} />
              </button>
              <button className="secondary" onClick={() => setIssuedKey(null)}>
                I HAVE STORED THIS KEY
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE TEAM MODAL */}
      {showTeamModal && (
        <div className="modal-overlay" onClick={() => setShowTeamModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <div>
                <p className="tag">&lt; TEAM PROVISIONING &gt;</p>
                <h2>Create Enterprise Team</h2>
              </div>
              <button className="modal-close" onClick={() => setShowTeamModal(false)}>
                <X size={14} style={{ display: "inline" }} />
              </button>
            </div>
            <form onSubmit={handleCreateTeam}>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label>TEAM NAME</label>
                <input required placeholder="e.g. Analytics Team" value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label>PRODUCT</label>
                <input required placeholder="e.g. Business Intelligence" value={newTeamProduct} onChange={(e) => setNewTeamProduct(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label>MONTHLY BUDGET ($ USD)</label>
                <input type="number" step="0.01" required value={newTeamLimit} onChange={(e) => setNewTeamLimit(e.target.value)} />
              </div>
              <button type="submit" style={{ width: '100%' }}>
                PROVISION TEAM <Play size={14} style={{ marginLeft: "6px", display: "inline" }} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CREATE AGENT MODAL */}
      {showAgentModal && (
        <div className="modal-overlay" onClick={() => setShowAgentModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <div>
                <p className="tag">&lt; AGENT PROVISIONING &gt;</p>
                <h2>Provision Governed Agent</h2>
              </div>
              <button className="modal-close" onClick={() => setShowAgentModal(false)}>
                <X size={14} style={{ display: "inline" }} />
              </button>
            </div>
            <form onSubmit={handleCreateAgent}>
              <div className="form-grid">
                <div className="form-group">
                  <label>ASSIGN TO TEAM</label>
                  <select value={newAgentTeamId} onChange={(e) => setNewAgentTeamId(e.target.value)}>
                    {adminTeams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.product})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>AGENT NAME</label>
                  <input required placeholder="e.g. Data Prep Agent" value={newAgentName} onChange={(e) => setNewAgentName(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>AGENT SLUG / ID</label>
                  <input required placeholder="e.g. data-prep-agent" value={newAgentSlug} onChange={(e) => setNewAgentSlug(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>MONTHLY BUDGET ($ USD)</label>
                  <input type="number" step="0.001" required value={newAgentMonthlyLimit} onChange={(e) => setNewAgentMonthlyLimit(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>DEFAULT SESSION BUDGET ($ USD)</label>
                  <input type="number" step="0.0001" required value={newAgentSessionLimit} onChange={(e) => setNewAgentSessionLimit(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>WARNING THRESHOLD (%)</label>
                  <input type="number" min="50" max="99" required value={newAgentWarningPercent} onChange={(e) => setNewAgentWarningPercent(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>PREFERRED MODEL</label>
                  <select value={newAgentPreferredModel} onChange={(e) => setNewAgentPreferredModel(e.target.value)}>
                    <option value="openai/gpt-oss-120b">openai/gpt-oss-120b (Groq 120B)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>FALLBACK MODEL</label>
                  <select value={newAgentFallbackModel} onChange={(e) => setNewAgentFallbackModel(e.target.value)}>
                    <option value="openai/gpt-oss-20b">openai/gpt-oss-20b (Groq 20B)</option>
                    <option value="">None (No Fallback)</option>
                  </select>
                </div>
              </div>
              <button type="submit" style={{ width: '100%', marginTop: '20px' }}>
                GENERATE AGENT & KEY <Play size={14} style={{ marginLeft: "6px", display: "inline" }} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* BUDGET REDUCTION SAFEGUARD MODAL */}
      {reductionWarning && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ borderColor: 'var(--red)', maxWidth: '540px' }}>
            <div className="modal-header">
              <div>
                <p className="tag" style={{ color: 'var(--red)' }}>
                  &lt; SAFEGUARD ALERT / BUDGET REDUCTION &gt;
                </p>
                <h2>Unsafe Budget Reduction</h2>
              </div>
              <button className="modal-close" onClick={() => setReductionWarning(null)}>
                <X size={14} style={{ display: "inline" }} />
              </button>
            </div>
            <p style={{ color: '#ccc', fontSize: '13px', lineHeight: '1.5' }}>
              The requested budget limit of <strong>{money(reductionWarning.newLimit)}</strong> is below the current consumed spend of{' '}
              <strong>{money(reductionWarning.detail.current_usage)}</strong> for {reductionWarning.teamName}.
            </p>
            <p style={{ color: 'var(--amber)', fontSize: '12px', marginTop: '10px' }}>
              Impacted agents: <code>{reductionWarning.detail.affected_agents.join(', ')}</code>
            </p>
            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button className="danger" onClick={() => handleUpdateTeamBudget(reductionWarning.teamId, reductionWarning.newLimit, true)}>
                FORCE OVERRIDE & REDUCE <Play size={14} style={{ marginLeft: "6px", display: "inline" }} />
              </button>
              <button className="secondary" onClick={() => setReductionWarning(null)}>
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REQUEST DETAIL AUDIT MODAL */}
      {selectedRequestId && requestDetail && (
        <div className="modal-overlay" onClick={() => setSelectedRequestId(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '720px' }}>
            <div className="modal-header">
              <div>
                <p className="tag">&lt; AUDIT TRAIL / REQUEST DETAIL &gt;</p>
                <h2>Request Lifecycle Trace</h2>
              </div>
              <button className="modal-close" onClick={() => setSelectedRequestId(null)}>
                <X size={14} style={{ display: "inline" }} /> CLOSE
              </button>
            </div>

            {/* Visual Sequence Flow */}
            {requestDetail.sequence_visual && (
              <div className="sequence-flow">
                {requestDetail.sequence_visual.map((step, idx) => (
                  <div key={idx} className="sequence-step">
                    <span className="sequence-box">{step}</span>
                    {idx < requestDetail.sequence_visual!.length - 1 && <span className="sequence-arrow">→</span>}
                  </div>
                ))}
              </div>
            )}

            <div className="audit-grid">
              <div className="audit-field">
                <label>REQUEST ID</label>
                <span>{requestDetail.id}</span>
              </div>
              <div className="audit-field">
                <label>DECISION</label>
                <span className={requestDetail.decision === 'BLOCK' ? 'red' : requestDetail.decision === 'REROUTE' ? 'amber' : 'green'}>
                  {requestDetail.decision} {requestDetail.reason ? `(${requestDetail.reason})` : ''}
                </span>
              </div>
              <div className="audit-field">
                <label>AGENT & TEAM</label>
                <span>
                  {requestDetail.agent?.name || '—'} ({requestDetail.team?.name || '—'})
                </span>
              </div>
              <div className="audit-field">
                <label>SESSION ID</label>
                <span>{requestDetail.session_id}</span>
              </div>
              <div className="audit-field">
                <label>REQUESTED MODEL</label>
                <span>{requestDetail.requested_model}</span>
              </div>
              <div className="audit-field">
                <label>SELECTED MODEL</label>
                <span>{requestDetail.selected_model || 'NONE (BLOCKED)'}</span>
              </div>
              <div className="audit-field">
                <label>ESTIMATED COST</label>
                <span>{money(requestDetail.estimated_cost)}</span>
              </div>
              <div className="audit-field">
                <label>ACTUAL RECONCILED COST</label>
                <span>{money(requestDetail.actual_cost)}</span>
              </div>
              <div className="audit-field">
                <label>PROMPT TOKENS</label>
                <span>{requestDetail.input_tokens ?? '—'}</span>
              </div>
              <div className="audit-field">
                <label>COMPLETION TOKENS</label>
                <span>{requestDetail.output_tokens ?? '—'}</span>
              </div>
              <div className="audit-field">
                <label>REASONING TOKENS</label>
                <span>{requestDetail.reasoning_tokens ?? '0'}</span>
              </div>
              <div className="audit-field">
                <label>IDEMPOTENCY KEY</label>
                <span>{requestDetail.idempotency_key || '—'} {requestDetail.cache_hit && <span className="pill green">CACHE HIT</span>}</span>
              </div>
              <div className="audit-field" style={{ gridColumn: 'span 2' }}>
                <label>PROVIDER REQUEST ID (GROQ)</label>
                <span>{requestDetail.provider_request_id || 'N/A (BLOCKED PRE-EXECUTION)'}</span>
              </div>
            </div>

            <div style={{ background: '#000', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--panel-border)', margin: '14px 0', fontSize: '11px', color: 'var(--text-muted)' }}>
              <Lock size={14} style={{ marginRight: "6px", display: "inline" }} /> <strong>PROMPT PRIVACY PROTECTION:</strong> Raw prompt content and text outputs are stripped prior to storage. Only token counts, execution metadata, and cost metrics are recorded in immutable ledger.
            </div>

            <h3 style={{ marginTop: '20px' }}>Ledger Events Timeline</h3>
            <div className="timeline">
              {requestDetail.ledger_events.map((evt) => (
                <div className="timeline-item" key={evt.id}>
                  <h4>{evt.event_type}</h4>
                  <p>
                    {new Date(evt.created_at).toLocaleString()} — {JSON.stringify(evt.metadata)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ENTERPRISE AUTHENTICATION MODAL */}
      {showAuthModal && (
        <div className="modal-overlay" onClick={() => setShowAuthModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <div>
                <p className="tag" style={{ color: '#c084fc' }}>&lt; CRYPTOGRAPHIC GATEWAY AUTHENTICATION &gt;</p>
                <h2>Admin Login & JWT Session</h2>
              </div>
              <button className="modal-close" onClick={() => setShowAuthModal(false)}>
                <X size={14} style={{ display: "inline" }} /> CLOSE
              </button>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Authenticate with your administrative secret key to generate a signed HS256 JWT access token for governance operations.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', display: 'block', marginBottom: '4px' }}>USERNAME / IDENTITY</label>
                <input
                  type="text"
                  style={{ width: '100%', padding: '8px 12px', background: '#000', border: '1px solid var(--border)', color: '#fff', borderRadius: '4px', fontSize: '13px' }}
                  value={authUsername}
                  onChange={(e) => setAuthUsername(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', display: 'block', marginBottom: '4px' }}>ADMIN SECRET KEY</label>
                <input
                  type="password"
                  style={{ width: '100%', padding: '8px 12px', background: '#000', border: '1px solid #8b5cf6', color: '#fff', borderRadius: '4px', fontSize: '13px' }}
                  value={authKey}
                  onChange={(e) => setAuthKey(e.target.value)}
                  placeholder="Enter admin secret..."
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', display: 'block', marginBottom: '4px' }}>RBAC ROLE SCOPE</label>
                <select
                  style={{ width: '100%', padding: '8px 12px', background: '#000', border: '1px solid var(--border)', color: '#fff', borderRadius: '4px', fontSize: '13px' }}
                  value={authRole}
                  onChange={(e) => setAuthRole(e.target.value as any)}
                >
                  <option value="ADMIN">ADMIN (Full Governance & Fleet Write Access)</option>
                  <option value="OPERATOR">OPERATOR (Incident Review & Action Access)</option>
                  <option value="VIEWER">VIEWER (Read-Only Audit & Fleet Access)</option>
                </select>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.4)', padding: '12px', borderRadius: '6px', border: '1px solid var(--panel-border)', marginTop: '8px' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>CURRENT TOKEN STATUS</div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: isAuthSuccess ? '#34d399' : '#fbbf24', marginTop: '2px' }}>
                  {isAuthSuccess ? `● Active Signed JWT Token (${authRole})` : '○ Unauthenticated / Legacy Fallback'}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                <button style={{ flex: 1, padding: '10px', fontSize: '12px', fontWeight: 600, background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }} onClick={handleLogin}>
                  <Key size={14} style={{ marginRight: "6px" }} /> GENERATE & SAVE JWT TOKEN
                </button>
                {isAuthSuccess && (
                  <button className="danger" style={{ padding: '10px 14px', fontSize: '12px', cursor: 'pointer' }} onClick={handleLogout}>
                    LOG OUT
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Visual Simulation Modal */}
      <AnimatePresence>
        {showSimulation.active && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              style={{ width: '800px', background: '#09090b', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '24px', padding: '40px', position: 'relative', boxShadow: '0 0 40px rgba(139, 92, 246, 0.15)' }}
            >
              <button style={{ position: 'absolute', top: '24px', right: '24px', background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }} onClick={() => setShowSimulation({ ...showSimulation, active: false })}><X size={24} /></button>
              
              <h2 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Activity size={24} color="var(--purple)" /> 
                Policy Enforcement Simulation: {showSimulation.type.toUpperCase()}
              </h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: '40px' }}>{showSimulation.message}</p>

              {/* Workflow Diagram */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '40px 0', position: 'relative' }}>
                
                {/* Node 1: Client */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', zIndex: 2 }}>
                   <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: showSimulation.step >= 0 ? 'var(--blue)' : '#222', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: showSimulation.step === 0 ? '0 0 20px var(--blue)' : 'none', transition: 'all 0.3s' }}>
                      <Terminal size={24} color="#fff" />
                   </div>
                   <span style={{ fontSize: '12px', fontWeight: 600, color: '#fff' }}>SDK Client</span>
                </div>

                {/* Line 1 */}
                <div style={{ height: '4px', flex: 1, background: showSimulation.step >= 1 ? 'var(--blue)' : '#222', margin: '0 -20px', zIndex: 1, position: 'relative', overflow: 'hidden' }}>
                   {showSimulation.step === 0 && <motion.div initial={{ x: '-100%' }} animate={{ x: '200%' }} transition={{ repeat: Infinity, duration: 1 }} style={{ width: '50%', height: '100%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)' }} />}
                </div>

                {/* Node 2: Gateway */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', zIndex: 2 }}>
                   <div style={{ width: '80px', height: '80px', borderRadius: '16px', background: showSimulation.step >= 1 ? 'var(--purple)' : '#222', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: showSimulation.step === 1 ? '0 0 30px var(--purple)' : 'none', transition: 'all 0.3s' }}>
                      <Shield size={32} color="#fff" />
                   </div>
                   <span style={{ fontSize: '12px', fontWeight: 600, color: '#fff' }}>0xNexigent</span>
                </div>

                {/* Line 2 (To Budget) */}
                <div style={{ height: '4px', flex: 1, background: showSimulation.step >= 2 ? 'var(--purple)' : '#222', margin: '0 -20px', zIndex: 1, position: 'relative', overflow: 'hidden' }}>
                   {showSimulation.step === 1 && <motion.div initial={{ x: '-100%' }} animate={{ x: '200%' }} transition={{ repeat: Infinity, duration: 1 }} style={{ width: '50%', height: '100%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)' }} />}
                </div>

                {/* Node 3: Budget Engine */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', zIndex: 2 }}>
                   <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: showSimulation.step >= 2 ? (showSimulation.type === 'block' || showSimulation.type === 'runaway' ? 'var(--red)' : 'var(--amber)') : '#222', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: showSimulation.step === 2 ? `0 0 20px ${showSimulation.type === 'block' || showSimulation.type === 'runaway' ? 'var(--red)' : 'var(--amber)'}` : 'none', transition: 'all 0.3s' }}>
                      <Database size={24} color="#fff" />
                   </div>
                   <span style={{ fontSize: '12px', fontWeight: 600, color: '#fff' }}>Budget Engine</span>
                </div>

                {/* Line 3 (To Upstream) */}
                <div style={{ height: '4px', flex: 1, background: showSimulation.step >= 3 ? (showSimulation.result?.decision === 'BLOCK' || showSimulation.type === 'block' || showSimulation.type === 'runaway' ? 'var(--red)' : 'var(--green)') : '#222', margin: '0 -20px', zIndex: 1, position: 'relative', overflow: 'hidden' }}>
                   {showSimulation.step === 2 && <motion.div initial={{ x: '-100%' }} animate={{ x: '200%' }} transition={{ repeat: Infinity, duration: 1 }} style={{ width: '50%', height: '100%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)' }} />}
                </div>

                {/* Node 4: Upstream Model */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', zIndex: 2 }}>
                   <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: showSimulation.step >= 3 ? (showSimulation.result?.decision === 'BLOCK' || showSimulation.type === 'block' || showSimulation.type === 'runaway' ? 'var(--red)' : 'var(--green)') : '#222', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: showSimulation.step === 3 ? `0 0 20px ${showSimulation.result?.decision === 'BLOCK' || showSimulation.type === 'block' || showSimulation.type === 'runaway' ? 'var(--red)' : 'var(--green)'}` : 'none', transition: 'all 0.3s' }}>
                      {showSimulation.step >= 3 && (showSimulation.result?.decision === 'BLOCK' || showSimulation.type === 'block' || showSimulation.type === 'runaway') ? <X size={24} color="#fff" /> : <Cloud size={24} color="#fff" />}
                   </div>
                   <span style={{ fontSize: '12px', fontWeight: 600, color: '#fff' }}>{showSimulation.step >= 3 ? (showSimulation.result?.model || 'Upstream') : 'Upstream'}</span>
                </div>

              </div>

              {/* Results Box */}
              <AnimatePresence>
                {showSimulation.step === 3 && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '24px', fontFamily: 'var(--font-mono)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>ENFORCEMENT OUTCOME:</span>
                      <span style={{ color: (showSimulation.result?.decision === 'BLOCK' || showSimulation.type === 'block' || showSimulation.type === 'runaway') ? 'var(--red)' : showSimulation.result?.decision === 'REROUTE' ? 'var(--amber)' : 'var(--green)', fontWeight: 700 }}>{showSimulation.result?.decision || 'ERROR'}</span>
                    </div>
                    <div style={{ fontSize: '14px', color: '#fff' }}>
                      {(showSimulation.result?.decision === 'BLOCK' || showSimulation.type === 'block' || showSimulation.type === 'runaway')
                        ? (showSimulation.result?.detail?.message || 'Request blocked due to policy constraints.')
                        : `Successfully routed to ${showSimulation.result?.model} within allowed budget bounds.`
                      }
                    </div>
                    <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
                      <button style={{ background: 'var(--purple)', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }} onClick={() => setShowSimulation({ ...showSimulation, active: false })}>Acknowledge</button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <p>{label}</p>
      <strong>{value}</strong>
    </div>
  );
}

export default App;
