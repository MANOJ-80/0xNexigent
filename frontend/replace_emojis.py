import re

with open('src/main.tsx', 'r') as f:
    content = f.read()

# Add imports if not present
if "lucide-react" not in content:
    content = content.replace("import './styles.css';", "import './styles.css';\nimport { Key, MessageSquare, BarChart, Building, Search, Settings, Sparkles, RefreshCw, Zap, Eraser, ShieldAlert, CheckCircle, AlertTriangle, Play, Square, Send, Copy, X, Lock, Eye, Check } from 'lucide-react';")

# Replacements (emoji -> Icon component)
replacements = {
    '🔑': '<Key size={14} style={{ marginRight: "6px" }} />',
    '💬': '<MessageSquare size={14} style={{ marginLeft: "6px" }} />',
    '📊': '<BarChart size={14} style={{ marginLeft: "6px" }} />',
    '🏢': '<Building size={14} style={{ marginLeft: "6px" }} />',
    '🔍': '<Search size={14} style={{ marginLeft: "6px" }} />',
    '⚙': '<Settings size={14} style={{ marginLeft: "6px" }} />',
    '⚠️': '<AlertTriangle size={14} style={{ marginRight: "6px", display: "inline" }} />',
    '🚨': '<ShieldAlert size={14} style={{ marginRight: "6px", display: "inline" }} />',
    '✅': '<CheckCircle size={14} style={{ marginRight: "6px", display: "inline" }} />',
    '❌': '<X size={14} style={{ marginRight: "6px", display: "inline" }} />',
    '🔄': '<RefreshCw size={14} style={{ marginRight: "6px", display: "inline" }} />',
    '🧠': '<Sparkles size={14} style={{ marginRight: "6px", display: "inline" }} />',
    '✨': '<Sparkles size={14} style={{ marginRight: "6px", display: "inline" }} />',
    '⚡': '<Zap size={14} style={{ marginRight: "6px", display: "inline" }} />',
    '🧹': '<Eraser size={14} style={{ marginRight: "6px", display: "inline" }} />',
    '🚀': '<Send size={14} style={{ marginRight: "6px", display: "inline" }} />',
    '🔒': '<Lock size={14} style={{ marginRight: "6px", display: "inline" }} />',
    '✏️': '<Settings size={14} style={{ marginLeft: "6px", display: "inline" }} />',
    '🛑': '<Square size={14} style={{ marginLeft: "6px", display: "inline" }} />',
    '↗': '<Play size={14} style={{ marginLeft: "6px", display: "inline" }} />',
    '📋': '<Copy size={14} style={{ marginLeft: "6px", display: "inline" }} />',
    '✕': '<X size={14} style={{ display: "inline" }} />',
}

for emoji, replacement in replacements.items():
    content = content.replace(emoji, replacement)

with open('src/main.tsx', 'w') as f:
    f.write(content)

print("Replaced emojis with Lucide icons.")
