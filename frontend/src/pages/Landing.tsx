import { useNavigate } from 'react-router-dom';
import { motion, Variants } from 'framer-motion';
import { 
  Volume2, Shield, Zap, Lock, Activity, Eye, ShieldAlert,
  FileText, GitBranch, Landmark
} from 'lucide-react';
import '../styles.css';

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 }
  }
};

const itemVariants: Variants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 100 } }
};

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="landing-container" style={{ background: '#0a0a0a', color: '#fff', minHeight: '100vh', overflowX: 'hidden', fontFamily: '"Inter", sans-serif' }}>
      
      {/* 1. HERO SECTION (Aivar Velogent 8-Node Style, but 0xNexigent Purple Theme) */}
      <section style={{ 
        position: 'relative', 
        minHeight: '100vh', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        paddingTop: '120px',
        overflow: 'hidden'
      }}>
        {/* Glowing Aura Background - 0xNexigent Purple */}
        <motion.div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '1400px',
          height: '1400px',
          background: 'radial-gradient(circle, rgba(122, 104, 255, 0.15) 0%, rgba(122, 104, 255, 0.05) 30%, transparent 60%)',
          zIndex: 0,
          pointerEvents: 'none'
        }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 2, ease: "easeOut" }}
        />

        <motion.div 
          variants={containerVariants} 
          initial="hidden" 
          animate="visible"
          style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: '800px', padding: '0 24px' }}
        >
          <motion.h1 variants={itemVariants} style={{ fontSize: '72px', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: '24px' }}>
            Meet<br />0xNexigent
          </motion.h1>
          
          <motion.p variants={itemVariants} style={{ fontSize: '20px', color: '#a1a1aa', marginBottom: '24px' }}>
            Enterprise AI Runtime Budget Governance for Business-Critical Workflows
          </motion.p>
          
          <motion.div variants={itemVariants} style={{ display: 'flex', justifyContent: 'center', marginBottom: '40px' }}>
            <div style={{ background: 'rgba(122, 104, 255, 0.05)', border: '1px solid rgba(122, 104, 255, 0.2)', padding: '6px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em', color: '#b8b0ff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              PRONOUNCED: ZERO-EX-NEX-IH-JENT <Volume2 size={14} />
            </div>
          </motion.div>

          <motion.button 
            variants={itemVariants}
            onClick={() => navigate('/login')}
            style={{
              background: '#fff',
              color: '#000',
              border: 'none',
              padding: '16px 32px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)',
              position: 'relative'
            }}
          >
            DEPLOY BUDGET PROXY
          </motion.button>
        </motion.div>

        {/* 8-Node Circuit Architecture Graphic */}
        <div style={{ position: 'relative', width: '100%', maxWidth: '1000px', margin: '60px auto 100px', height: '800px', zIndex: 1 }}>
          
          {/* Center Glowing Logo (Purple Shield) */}
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10 }}>
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ 
                scale: 1, 
                opacity: 1,
                boxShadow: '0 0 60px rgba(122, 104, 255, 0.6), inset 0 0 20px rgba(255,255,255,0.5)'
              }}
              transition={{ duration: 1, ease: "easeOut" }}
              style={{
                width: '120px',
                height: '120px',
                background: 'linear-gradient(135deg, #9587ff 0%, #7a68ff 100%)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '4px solid rgba(255,255,255,0.1)'
              }}
            >
              <Shield size={50} color="#fff" />
            </motion.div>
          </div>

          {/* Orthogonal Dotted connecting lines (SVG) */}
          <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1, pointerEvents: 'none' }} viewBox="0 0 1000 800">
            {/* Top */}
            <path d="M 500 330 L 500 130" stroke="rgba(161, 161, 170, 0.4)" strokeWidth="2" strokeDasharray="4 4" fill="none" />
            {/* Bottom */}
            <path d="M 500 470 L 500 670" stroke="rgba(161, 161, 170, 0.4)" strokeWidth="2" strokeDasharray="4 4" fill="none" />
            {/* Left */}
            <path d="M 430 400 L 330 400" stroke="rgba(161, 161, 170, 0.4)" strokeWidth="2" strokeDasharray="4 4" fill="none" />
            {/* Right */}
            <path d="M 570 400 L 670 400" stroke="rgba(161, 161, 170, 0.4)" strokeWidth="2" strokeDasharray="4 4" fill="none" />

            {/* Top-Left */}
            <path d="M 460 350 L 460 250 L 375 250" stroke="rgba(161, 161, 170, 0.4)" strokeWidth="2" strokeDasharray="4 4" fill="none" />
            {/* Top-Right */}
            <path d="M 540 350 L 540 250 L 625 250" stroke="rgba(161, 161, 170, 0.4)" strokeWidth="2" strokeDasharray="4 4" fill="none" />
            {/* Bottom-Left */}
            <path d="M 460 450 L 460 550 L 375 550" stroke="rgba(161, 161, 170, 0.4)" strokeWidth="2" strokeDasharray="4 4" fill="none" />
            {/* Bottom-Right */}
            <path d="M 540 450 L 540 550 L 625 550" stroke="rgba(161, 161, 170, 0.4)" strokeWidth="2" strokeDasharray="4 4" fill="none" />
              
            {/* Connection Dots (Nodes endpoints) */}
            {[
              [500, 130], [500, 670], [330, 400], [670, 400],
              [375, 250], [625, 250], [375, 550], [625, 550]
            ].map((pt, i) => (
               <circle key={i} cx={pt[0]} cy={pt[1]} r="3" fill="rgba(161, 161, 170, 0.4)" />
            ))}
          </svg>

          {/* Outer Nodes (8 Nodes - 0xNexigent specific) */}
          {[
            { top: '100px', left: '500px', label: 'Token Quota Enforcement', icon: <Lock size={16} color="#a1a1aa" /> },
            { top: '700px', left: '500px', label: 'Cost Reconciliation', icon: <Landmark size={16} color="#a1a1aa" /> },
            { top: '400px', left: '200px', label: 'Pre-Execution Block', icon: <ShieldAlert size={16} color="#a1a1aa" /> },
            { top: '400px', left: '800px', label: 'Real-Time Rerouting', icon: <Zap size={16} color="#a1a1aa" /> },
            { top: '250px', left: '250px', label: 'Cryptographic Audit Ledger', icon: <FileText size={16} color="#a1a1aa" /> },
            { top: '250px', left: '750px', label: 'Dynamic Fallback Routing', icon: <GitBranch size={16} color="#a1a1aa" /> },
            { top: '550px', left: '250px', label: 'Runaway Detection', icon: <Activity size={16} color="#a1a1aa" /> },
            { top: '550px', left: '750px', label: 'Zero Latency Proxy', icon: <Eye size={16} color="#a1a1aa" /> },
          ].map((node, i) => (
            <div key={i} style={{ position: 'absolute', top: node.top, left: node.left, transform: 'translate(-50%, -50%)', zIndex: 5, width: 'max-content' }}>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: [0, -4, 0] }}
                transition={{ opacity: { duration: 0.5, delay: 0.5 }, y: { duration: 3, repeat: Infinity, ease: "easeInOut", delay: i * 0.3 } }}
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  padding: '12px 20px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  backdropFilter: 'blur(10px)',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
                }}
              >
                {node.icon}
                <span style={{ fontSize: '14px', fontWeight: 500, color: '#e4e4e7' }}>{node.label}</span>
              </motion.div>
            </div>
          ))}
        </div>
      </section>

      {/* 2. MIDDLE SECTION (Purple Theme Split Column) */}
      <section style={{ background: '#f4f4f5', color: '#18181b', padding: '120px 0', borderTop: '1px solid #e4e4e7', borderBottom: '1px solid #e4e4e7' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0', position: 'relative' }}>
          
          {/* Tech crop corners (top-left, bottom-left) */}
          <div style={{ position: 'absolute', top: '-10px', left: '-10px', width: '20px', height: '20px', borderTop: '2px solid #a1a1aa', borderLeft: '2px solid #a1a1aa' }} />
          <div style={{ position: 'absolute', bottom: '-10px', left: '-10px', width: '20px', height: '20px', borderBottom: '2px solid #a1a1aa', borderLeft: '2px solid #a1a1aa' }} />
          <div style={{ position: 'absolute', top: '-10px', right: '-10px', width: '20px', height: '20px', borderTop: '2px solid #a1a1aa', borderRight: '2px solid #a1a1aa' }} />
          <div style={{ position: 'absolute', bottom: '-10px', right: '-10px', width: '20px', height: '20px', borderBottom: '2px solid #a1a1aa', borderRight: '2px solid #a1a1aa' }} />

          {/* Center divider line */}
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: '1px', background: '#e4e4e7' }} />

          {/* Left Column (Light) */}
          <div style={{ padding: '60px 80px 60px 40px' }}>
            <p style={{ color: '#7a68ff', fontSize: '12px', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '24px' }}>
              &lt; INTRODUCTION &gt;
            </p>
            <h2 style={{ fontSize: '56px', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: '32px' }}>
              AI Governance<br />That Intercepts<br />Cost Overruns,<br />In Real-Time.
            </h2>
            <p style={{ fontSize: '12px', fontWeight: 600, color: '#a1a1aa', letterSpacing: '0.05em', marginBottom: '12px' }}>
              WHAT IT DOES:
            </p>
            <p style={{ fontSize: '18px', color: '#52525b', lineHeight: 1.6, marginBottom: '40px' }}>
              0xNexigent enforces hard budgetary constraints on your AI agents at runtime. Not retrospective billing reports—a zero-latency proxy that evaluates token costs before execution, automatically rerouting or blocking requests that violate your financial policies.
            </p>
            <button 
              onClick={() => navigate('/login')}
              style={{
                background: '#7a68ff',
                color: '#fff',
                border: 'none',
                padding: '16px 32px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)'
              }}
            >
              DEPLOY PROXY NOW
            </button>
          </div>

          {/* Right Column (Dark Block) */}
          <div style={{ background: '#18181b', color: '#fff', padding: '60px 80px', position: 'relative' }}>
            <p style={{ fontSize: '18px', lineHeight: 1.6, marginBottom: '24px', color: '#e4e4e7' }}>
              A high-performance Rust/FastAPI proxy that sits between your application and your LLM providers. Stop runaway infinite loops, prevent unauthorized model usage, and implement <span style={{ color: '#b8b0ff' }}>cryptographically verifiable audit trails</span> for every single API call.
            </p>
            
            <p style={{ fontSize: '12px', fontWeight: 600, color: '#a1a1aa', letterSpacing: '0.05em', marginBottom: '12px' }}>
              CORE CAPABILITIES:
            </p>
            <p style={{ fontSize: '16px', lineHeight: 1.6, marginBottom: '32px', color: '#b8b0ff' }}>
              Built for enterprise AI architectures where budget predictability and security compliance are non-negotiable.
            </p>

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 40px 0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                'Zero-Latency Token Estimation',
                'Hard Quota Enforcement',
                'Model-Tier Fallback Routing',
                'Immutable Audit Ledger'
              ].map((item, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '16px', color: '#e4e4e7' }}>
                  <span style={{ color: '#7a68ff', fontWeight: 'bold' }}>&gt;</span> {item}
                </li>
              ))}
            </ul>

            <p style={{ fontSize: '12px', fontWeight: 600, color: '#a1a1aa', letterSpacing: '0.05em', marginBottom: '12px' }}>
              THE MISSION:
            </p>
            <p style={{ fontSize: '16px', color: '#e4e4e7' }}>
              Give developers the freedom to build complex multi-agent systems without the risk of unpredictable runaway costs.
            </p>
          </div>
        </div>
      </section>
      
      {/* Footer Area with Grid */}
      <section style={{ height: '300px', background: '#0a0a0a', position: 'relative' }}>
         <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
         <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
            <p style={{ color: '#e4e4e7', fontSize: '24px', fontWeight: 600, marginBottom: '24px' }}>Execute Freely. Govern by Default.</p>
            <p className="tag" style={{ color: '#7a68ff' }}>&lt; ENTERPRISE GRADE &gt;</p>
         </div>
      </section>

    </div>
  );
}
