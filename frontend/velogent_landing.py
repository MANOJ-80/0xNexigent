import os

new_landing = """import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Volume2, Shield, Zap, Lock, Activity, Eye, ShieldAlert } from 'lucide-react';
import '../styles.css';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 100 } }
};

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="landing-container" style={{ background: '#0a0a0a', color: '#fff', minHeight: '100vh', overflowX: 'hidden', fontFamily: '"Inter", sans-serif' }}>
      
      {/* 1. HERO SECTION (Aivar Velogent Style) */}
      <section style={{ 
        position: 'relative', 
        minHeight: '100vh', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        paddingTop: '120px',
        overflow: 'hidden'
      }}>
        {/* Glowing Aura Background */}
        <div style={{
          position: 'absolute',
          top: '40%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '1200px',
          height: '1200px',
          background: 'radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, rgba(139, 92, 246, 0.05) 30%, transparent 60%)',
          zIndex: 0,
          pointerEvents: 'none'
        }} />

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
            <div style={{ background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.2)', padding: '6px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em', color: '#c084fc', display: 'flex', alignItems: 'center', gap: '8px' }}>
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

        {/* Central Node & Connecting Nodes Graphic */}
        <div style={{ position: 'relative', width: '100%', height: '500px', marginTop: '60px', zIndex: 1 }}>
          {/* Center Glowing Logo */}
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1, delay: 0.5 }}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '100px',
              height: '100px',
              background: '#8b5cf6',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 60px rgba(139, 92, 246, 0.6), inset 0 0 20px rgba(255,255,255,0.5)',
              zIndex: 10
            }}
          >
            <Shield size={40} color="#fff" />
          </motion.div>

          {/* Dotted connecting lines (SVG) */}
          <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1, pointerEvents: 'none' }}>
            <motion.path 
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.3 }}
              transition={{ duration: 1.5, delay: 0.8 }}
              d="M calc(50% - 50px) 50% L calc(50% - 250px) 30%" stroke="#fff" strokeWidth="1" strokeDasharray="4 4" fill="none" 
            />
            <motion.path 
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.3 }}
              transition={{ duration: 1.5, delay: 0.9 }}
              d="M calc(50% + 50px) 50% L calc(50% + 250px) 30%" stroke="#fff" strokeWidth="1" strokeDasharray="4 4" fill="none" 
            />
            <motion.path 
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.3 }}
              transition={{ duration: 1.5, delay: 1.0 }}
              d="M calc(50% - 50px) 50% L calc(50% - 250px) 70%" stroke="#fff" strokeWidth="1" strokeDasharray="4 4" fill="none" 
            />
            <motion.path 
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.3 }}
              transition={{ duration: 1.5, delay: 1.1 }}
              d="M calc(50% + 50px) 50% L calc(50% + 250px) 70%" stroke="#fff" strokeWidth="1" strokeDasharray="4 4" fill="none" 
            />
          </svg>

          {/* Outer Nodes */}
          {[
            { top: '30%', left: 'calc(50% - 250px)', label: 'Real-Time Rerouting', icon: <Zap size={16} color="#a1a1aa" /> },
            { top: '30%', left: 'calc(50% + 250px)', label: 'Pre-Execution Block', icon: <ShieldAlert size={16} color="#a1a1aa" /> },
            { top: '70%', left: 'calc(50% - 250px)', label: 'Runaway Detection', icon: <Activity size={16} color="#a1a1aa" /> },
            { top: '70%', left: 'calc(50% + 250px)', label: 'Zero Latency Proxy', icon: <Eye size={16} color="#a1a1aa" /> },
          ].map((node, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 1.2 + (i * 0.1) }}
              style={{
                position: 'absolute',
                top: node.top,
                left: node.left,
                transform: 'translate(-50%, -50%)',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                padding: '12px 20px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                backdropFilter: 'blur(10px)',
                zIndex: 5
              }}
            >
              {node.icon}
              <span style={{ fontSize: '14px', fontWeight: 500, color: '#e4e4e7' }}>{node.label}</span>
            </motion.div>
          ))}
        </div>
      </section>

      {/* 2. MIDDLE SECTION (Light Theme Split Column with Tech Brackets) */}
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
            <p style={{ color: '#8b5cf6', fontSize: '12px', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '24px' }}>
              &lt; INTRODUCTION &gt;
            </p>
            <h2 style={{ fontSize: '56px', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: '32px' }}>
              Spend Control<br />That Handles<br />Millions of Tokens,<br />Not Just Happy Paths.
            </h2>
            <p style={{ fontSize: '12px', fontWeight: 600, color: '#a1a1aa', letterSpacing: '0.05em', marginBottom: '12px' }}>
              WHAT IT DOES:
            </p>
            <p style={{ fontSize: '18px', color: '#52525b', lineHeight: 1.6, marginBottom: '40px' }}>
              0xNexigent automates budget enforcement, model rerouting, and runaway detection for enterprise AI fleets. Not basic token counting that breaks on edge cases—intelligent routing that reasons through exceptions, validates limits, and blocks only when truly needed.
            </p>
            <button 
              onClick={() => navigate('/login')}
              style={{
                background: '#8b5cf6',
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
          <div style={{ background: '#18181b', color: '#fff', padding: '60px 80px' }}>
            <p style={{ fontSize: '18px', lineHeight: 1.6, marginBottom: '24px', color: '#e4e4e7' }}>
              AI agents that autonomously execute complex business workflows. Inference processing, context intelligence, parallel tool calls, document generation—<span style={{ color: '#a78bfa' }}>100% deterministic budget control with sub-millisecond latency</span>. Built for regulated industries where "good enough" doesn't cut it.
            </p>
            
            <p style={{ fontSize: '12px', fontWeight: 600, color: '#a1a1aa', letterSpacing: '0.05em', marginBottom: '12px' }}>
              BUILT FOR:
            </p>
            <p style={{ fontSize: '16px', lineHeight: 1.6, marginBottom: '32px', color: '#a78bfa' }}>
              Finance, logistics, healthcare, and manufacturing where predictability and audit trails are non-negotiable.
            </p>

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 40px 0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                'Hard Pre-Execution Blocks',
                'Automatic Safe Model Fallbacks',
                'Runaway LoopAgent Breakers',
                'Cryptographic Audit Ledgers'
              ].map((item, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '16px', color: '#e4e4e7' }}>
                  <span style={{ color: '#8b5cf6', fontWeight: 'bold' }}>&gt;</span> {item}
                </li>
              ))}
            </ul>

            <p style={{ fontSize: '12px', fontWeight: 600, color: '#a1a1aa', letterSpacing: '0.05em', marginBottom: '12px' }}>
              THE NAME:
            </p>
            <p style={{ fontSize: '16px', color: '#e4e4e7' }}>
              Next + Intelligent = Nexigent. Governance automation at machine speed with enterprise-level precision.
            </p>
          </div>
        </div>
      </section>
      
      {/* Footer Area with Grid */}
      <section style={{ height: '300px', background: '#0a0a0a', position: 'relative' }}>
         <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
         <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
            <p style={{ color: '#e4e4e7', fontSize: '24px', fontWeight: 600, marginBottom: '24px' }}>Govern by Default.</p>
            <p className="tag" style={{ color: '#8b5cf6' }}>&lt; ENTERPRISE CONTROL PLANE &gt;</p>
         </div>
      </section>

    </div>
  );
}
"""

with open('src/pages/Landing.tsx', 'w') as f:
    f.write(new_landing)

print("Updated Landing.tsx to exactly match Aivar Velogent AI layout.")
