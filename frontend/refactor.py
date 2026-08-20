import re

# 1. Refactor Dashboard.tsx
with open('src/pages/Dashboard.tsx', 'r') as f:
    dashboard = f.read()

# Remove the `createRoot` at the bottom
dashboard = re.sub(r"createRoot\(document\.getElementById\('root'\)!\)\.render\(<App />\);", "export default App;", dashboard)

# Import useNavigate
dashboard = dashboard.replace(
    "import { motion, AnimatePresence } from 'framer-motion';",
    "import { motion, AnimatePresence } from 'framer-motion';\nimport { useNavigate } from 'react-router-dom';"
)

# Remove all the Types and utils and import them from lib
types_pattern = r"type Overview = \{.*?\n\};\n\n"
utils_pattern = r"const money = .*?\nconst state = \(percent: number\) => \(percent >= 100 \? 'red' : percent >= 80 \? 'amber' : 'green'\);\n\n"
auth_pattern = r"const getAuthHeaders = \(\): Record<string, string> => \{.*?^\};\n\n"

# Actually it's safer to just replace the whole type block at the top
type_start = dashboard.find("type Overview = {")
type_end = dashboard.find("function App() {")

if type_start != -1 and type_end != -1:
    imports = "import { Overview, SessionItem, IncidentItem, IncidentDetail, AdminTeam, AdminAgent, AdminKey, WebhookItem, WebhookDelivery, ChatMessage, RequestDetail, TabId } from '../lib/types';\n"
    imports += "import { money, displayPercent, budgetState as state } from '../lib/utils';\n"
    imports += "import { getAuthHeaders, isAuthenticated, logout } from '../lib/auth';\n\n"
    
    dashboard = dashboard[:type_start] + imports + dashboard[type_end:]

# Change "const handleLogout = ..." to use auth.logout and navigate
logout_replacement = """
  const navigate = useNavigate();
  const handleLogout = () => {
    logout();
    navigate('/login');
  };
"""
# Replace handleLogin logic block to just redirect to login if not authenticated
# Wait, let's just replace the handleLogout function inside App
dashboard = re.sub(r"const handleLogout = \(\) => \{\n\s*localStorage\.removeItem\('nexigent_jwt_token'\);\n\s*setIsAuthSuccess\(false\);\n\s*setNotice\('UNAUTHENTICATED / LOCAL DEMO MODE'\);\n\s*setShowAuthModal\(true\);\n\s*\};", logout_replacement, dashboard)

# 2. Refactor main.tsx
main_content = """import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './styles.css';

import Landing from './pages/Landing';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
"""

with open('src/pages/Dashboard.tsx', 'w') as f:
    f.write(dashboard)

with open('src/main.tsx', 'w') as f:
    f.write(main_content)

print("Refactor complete")
