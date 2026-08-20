import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Key } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [role, setRole] = useState<'ADMIN' | 'OPERATOR' | 'VIEWER'>('ADMIN');
  const [email, setEmail] = useState('admin@nexigent.io');
  const [secret, setSecret] = useState('my-super-secret-admin-key-2026'); // Hardcoded for public demo access
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_key: secret, username: email, role }),
      });
      if (res.ok) {
        const authRes = await res.json();
        localStorage.setItem('nexigent_jwt_token', authRes.access_token);
        navigate('/dashboard');
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`Authentication Failed: ${err.detail?.message || 'Invalid administrative secret key.'}`);
      }
    } catch (e) {
      alert('Network Error connecting to gateway.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        style={{ width: '100%', maxWidth: '440px' }}
      >
        <div className="panel spotlight-card animated-border" style={{ padding: '40px' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ display: 'inline-flex', background: 'rgba(122, 104, 255, 0.1)', padding: '16px', borderRadius: '50%', marginBottom: '16px' }}>
              <Key size={32} color="var(--purple)" />
            </div>
            <h2 style={{ fontSize: '24px', letterSpacing: '-0.02em', marginBottom: '8px' }}>Gateway Authentication</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Enter your administrative credentials to access the 0xNexigent control plane.</p>
          </div>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="form-group">
              <label>ACCESS ROLE</label>
              <select value={role} onChange={(e) => setRole(e.target.value as any)}>
                <option value="ADMIN">Administrator (Full Access)</option>
                <option value="OPERATOR">Operator (Manage Fleet)</option>
                <option value="VIEWER">Auditor (Read-Only)</option>
              </select>
            </div>
            <div className="form-group">
              <label>USER IDENTITY</label>
              <input type="text" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="form-group">
              <label>ADMINISTRATIVE SECRET</label>
              <input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} />
            </div>
            
            <button type="submit" disabled={loading} className="animated-border" style={{ marginTop: '12px', padding: '14px', fontSize: '14px', border: 'none' }}>
              <span style={{ position: 'relative', zIndex: 2 }}>
              {loading ? 'AUTHENTICATING...' : 'ESTABLISH SECURE SESSION'}
              </span>
            </button>
          </form>

          <div style={{ marginTop: '24px', textAlign: 'center' }}>
            <button className="secondary" onClick={() => navigate('/')} style={{ padding: '8px 16px', fontSize: '10px' }}>
              &larr; BACK TO TERMINAL
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
