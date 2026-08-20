import React, { useState } from 'react';
import { Zap, Key, ShieldAlert, CheckCircle, Copy, Terminal, Server, Code, LifeBuoy } from 'lucide-react';
import { motion } from 'framer-motion';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

const CodeBlock = ({ code, language = 'python' }: { code: string, language?: string }) => {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ background: '#000', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', position: 'relative', marginTop: '16px', marginBottom: '24px', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{language}</span>
        <button 
          onClick={handleCopy}
          style={{ background: 'transparent', border: 'none', color: copied ? 'var(--green)' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', transition: 'color 0.2s' }}
        >
          {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <div style={{ padding: '0', overflowX: 'auto', fontSize: '13px' }}>
        <SyntaxHighlighter
          language={language}
          style={vscDarkPlus}
          customStyle={{
            margin: 0,
            padding: '16px',
            background: 'transparent',
            fontFamily: 'var(--font-mono)',
            lineHeight: 1.5,
          }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
};

export const DocsTab = () => {
  const [activeSection, setActiveSection] = useState('intro');

  const scrollTo = (id: string) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const sections = [
    { id: 'intro', label: 'Introduction & Overview', icon: <Server size={14} /> },
    { id: 'getting-started', label: 'Getting Started', icon: <Terminal size={14} /> },
    { id: 'integration', label: 'Integration Guide', icon: <Code size={14} /> },
    { id: 'configuration', label: 'Configuration & API', icon: <Key size={14} /> },
    { id: 'examples', label: 'Examples & Use Cases', icon: <Zap size={14} /> },
    { id: 'troubleshooting', label: 'Troubleshooting & FAQ', icon: <LifeBuoy size={14} /> },
  ];

  return (
    <motion.div key="docs" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }} style={{ height: 'calc(100vh - 120px)', display: 'flex', gap: '32px' }}>
      
      {/* Sidebar Navigation */}
      <aside style={{ width: '260px', flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.05)', paddingRight: '24px', display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}>
        <div style={{ padding: '0 12px', marginBottom: '16px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em' }}>DOCUMENTATION</span>
        </div>
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => scrollTo(s.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '12px 16px', borderRadius: '8px', background: activeSection === s.id ? 'rgba(255,255,255,0.05)' : 'transparent', color: activeSection === s.id ? '#fff' : 'var(--text-muted)', border: activeSection === s.id ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent', cursor: 'pointer', textAlign: 'left', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', transition: 'all 0.2s'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', width: '20px', color: activeSection === s.id ? 'var(--purple)' : 'inherit' }}>
              {s.icon}
            </div>
            {s.label}
          </button>
        ))}
      </aside>

      {/* Main Content Area */}
      <main style={{ flex: 1, overflowY: 'auto', paddingRight: '32px', scrollBehavior: 'smooth' }} className="docs-content">
        <div style={{ maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '64px', paddingBottom: '120px' }}>
          
          {/* Introduction */}
          <section id="intro">
            <h1 style={{ fontSize: '32px', fontWeight: 600, margin: '0 0 16px 0', color: '#fff' }}>Introduction & Overview</h1>
            <p style={{ fontSize: '15px', lineHeight: 1.7, color: 'var(--text-muted)', marginBottom: '24px' }}>
              0xNexigent is an enterprise-grade AI Runtime Budget Governance gateway. It acts as a transparent reverse-proxy that intercepts LLM API requests, evaluates them against pre-defined organizational budgets, and either routes, warns, or hard-blocks requests before they hit the upstream provider (e.g., OpenAI, Anthropic).
            </p>
            <div style={{ background: 'rgba(122,104,255,0.05)', border: '1px solid rgba(122,104,255,0.2)', padding: '24px', borderRadius: '12px' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldAlert size={16} color="var(--purple)" /> Core Capabilities
              </h3>
              <ul style={{ margin: 0, paddingLeft: '24px', color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.6 }}>
                <li><strong>Budget Enforcement:</strong> Granular limits at the Team, Agent, and Session levels.</li>
                <li><strong>Dynamic Routing:</strong> Automatically fallback to cheaper models when budget constraints tighten.</li>
                <li><strong>Anomaly Detection:</strong> Circuit breakers that pause agents exhibiting runaway recursive loops.</li>
                <li><strong>Zero-Friction Integration:</strong> Drop-in compatible with standard OpenAI SDKs and LangChain.</li>
              </ul>
            </div>
          </section>

          {/* Getting Started */}
          <section id="getting-started">
            <h2 style={{ fontSize: '24px', fontWeight: 600, margin: '0 0 16px 0', color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px' }}>Getting Started</h2>
            <p style={{ fontSize: '15px', lineHeight: 1.7, color: 'var(--text-muted)' }}>
              Before integrating your agents, you must configure a Fleet Budget within the 0xNexigent dashboard.
            </p>
            <ol style={{ paddingLeft: '24px', color: '#ccc', fontSize: '14px', lineHeight: 1.8, marginBottom: '24px' }}>
              <li>Navigate to the <strong>Admin Config & Keys</strong> tab.</li>
              <li>Generate a new <strong>Agent Key</strong> (e.g., <code>nx_ag_123456789</code>).</li>
              <li>Navigate to the <strong>Fleet & Budget Control</strong> tab.</li>
              <li>Assign a monthly token budget constraint for your new agent.</li>
            </ol>
            <CodeBlock 
              language="bash"
              code={`# Verify your key is active against the proxy\ncurl -X POST "https://nexigent-tau.vercel.app/v1/chat/completions" \\\n  -H "Authorization: Bearer nx_ag_YOUR_AGENT_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model": "openai/gpt-oss-120b", "messages": [{"role": "user", "content": "Hi"}]}'`}
            />
          </section>

          {/* Integration Guide */}
          <section id="integration">
            <h2 style={{ fontSize: '24px', fontWeight: 600, margin: '0 0 16px 0', color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px' }}>Integration Guide</h2>
            <p style={{ fontSize: '15px', lineHeight: 1.7, color: 'var(--text-muted)', marginBottom: '24px' }}>
              0xNexigent operates by mimicking the OpenAI REST API specification. This means you do not need to rewrite your agent logic. Simply override the <code>base_url</code> of your existing SDK client.
            </p>
            
            <h3 style={{ fontSize: '18px', color: '#fff', margin: '32px 0 16px 0' }}>Native Python (OpenAI SDK)</h3>
            <CodeBlock 
              language="python"
              code={`from openai import AsyncOpenAI\n\n# Point directly to the Nexigent Gateway instead of api.openai.com\nclient = AsyncOpenAI(\n    base_url="https://nexigent-tau.vercel.app/v1",\n    api_key="nx_ag_YOUR_AGENT_KEY"\n)\n\n# Standard API call - Nexigent evaluates budget pre-flight\nresponse = await client.chat.completions.create(\n    model="openai/gpt-oss-120b",\n    messages=[{"role": "user", "content": "Analyze these logs."}]\n)`}
            />

            <h3 style={{ fontSize: '18px', color: '#fff', margin: '32px 0 16px 0' }}>LangChain Integration</h3>
            <p style={{ fontSize: '14px', lineHeight: 1.7, color: 'var(--text-muted)' }}>
              For complex agentic workflows built on LangChain, initialize your <code>ChatOpenAI</code> model with the overridden base URL.
            </p>
            <CodeBlock 
              language="python"
              code={`from langchain_openai import ChatOpenAI\nfrom langchain_core.messages import HumanMessage\n\nllm = ChatOpenAI(\n    openai_api_base="https://nexigent-tau.vercel.app/v1",\n    openai_api_key="nx_ag_YOUR_AGENT_KEY",\n    model_name="openai/gpt-oss-120b",\n    max_retries=2\n)\n\n# Executes securely through the governance layer\nresponse = llm.invoke([HumanMessage(content="Hello AI")])`}
            />
          </section>

          {/* Configuration & API */}
          <section id="configuration">
            <h2 style={{ fontSize: '24px', fontWeight: 600, margin: '0 0 16px 0', color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px' }}>Configuration & Tracking</h2>
            
            <h3 style={{ fontSize: '18px', color: '#fff', margin: '24px 0 16px 0' }}>Session Budget Isolation</h3>
            <p style={{ fontSize: '15px', lineHeight: 1.7, color: 'var(--text-muted)' }}>
              If your agent serves multiple distinct users (e.g., a customer support bot), you should isolate budgets per-session to prevent a single malicious user from draining the agent's global budget. Pass a unique <code>session_id</code> in your request JSON payload (you can use <code>extra_body</code> in the OpenAI Python SDK).
            </p>
            <CodeBlock 
              language="python"
              code={`response = await client.chat.completions.create(\n    model="openai/gpt-oss-120b",\n    messages=[{"role": "user", "content": "Help me with my account."}],\n    extra_body={"session_id": "customer_support_session_982"}\n)`}
            />
          </section>

          {/* Examples & Use Cases */}
          <section id="examples">
            <h2 style={{ fontSize: '24px', fontWeight: 600, margin: '0 0 16px 0', color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px' }}>Examples & Use Cases</h2>
            <h3 style={{ fontSize: '18px', color: '#fff', margin: '24px 0 16px 0' }}>Handling Governance Interceptions</h3>
            <p style={{ fontSize: '15px', lineHeight: 1.7, color: 'var(--text-muted)' }}>
              A robust agent must be able to handle cases where it is blocked by the gateway. 0xNexigent mirrors standard HTTP error codes, so you can catch standard SDK exceptions.
            </p>
            <CodeBlock 
              language="python"
              code={`import openai\n\ntry:\n    response = await client.chat.completions.create(\n        model="openai/gpt-oss-120b",\n        messages=[{"role": "user", "content": "Write a massive novel."}]\n    )\nexcept openai.RateLimitError as e:\n    # HTTP 429: Agent/Session Budget Exhausted OR Circuit Breaker triggered\n    print(f"Governance Block or Safety Pause: {e}")`}
            />
          </section>

          {/* Troubleshooting */}
          <section id="troubleshooting">
            <h2 style={{ fontSize: '24px', fontWeight: 600, margin: '0 0 16px 0', color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px' }}>Troubleshooting & FAQ</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginTop: '24px' }}>
              <div>
                <h4 style={{ color: '#fff', margin: '0 0 8px 0', fontSize: '16px' }}>I'm getting a 401 Unauthorized error</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.6, margin: 0 }}>
                  Ensure your Agent Key starts with <code>nx_ag_</code> and is currently active in the Admin Dashboard. If an admin revokes the key, all subsequent requests will immediately fail with 401.
                </p>
              </div>
              <div>
                <h4 style={{ color: '#fff', margin: '0 0 8px 0', fontSize: '16px' }}>My requests are being routed to a different model</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.6, margin: 0 }}>
                  This happens when <strong>Dynamic Routing</strong> is enabled and your agent approaches its budget ceiling. The gateway intercepts requests for expensive models (e.g., <code>openai/gpt-oss-120b</code>) and seamlessly routes them to the configured fallback model (e.g., <code>openai/gpt-oss-20b</code>). Check the Audit Logs tab to see the interception trace.
                </p>
              </div>
              <div>
                <h4 style={{ color: '#fff', margin: '0 0 8px 0', fontSize: '16px' }}>How are tokens counted?</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.6, margin: 0 }}>
                  0xNexigent uses token counting in the pre-flight phase to calculate an estimated cost. Note that the preflight cost is only an estimate, and the actual provider usage is authoritative and will be reconciled after execution.
                </p>
              </div>
            </div>
          </section>

        </div>
      </main>

    </motion.div>
  );
};
