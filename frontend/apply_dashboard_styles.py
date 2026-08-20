import re

with open('src/pages/Dashboard.tsx', 'r') as f:
    content = f.read()

# 1. Update framer-motion import
content = content.replace(
    "import { motion, AnimatePresence } from 'framer-motion';",
    "import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';"
)

# 2. Inject TiltCard component right before function App()
tilt_card = """
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
"""

content = content.replace("function App() {", tilt_card + "\nfunction App() {")
# Need to import React for useState since it's used in TiltCard
content = content.replace("import { useEffect, useRef, useState } from 'react';", "import React, { useEffect, useRef, useState } from 'react';")

# 3. Apply text-gradient to Dashboard header
content = content.replace(
    "<h1>\n            Spend control <em>before</em> execution.\n          </h1>",
    "<h1>\n            <span className=\"text-gradient\">Spend control</span> <em>before</em> execution.\n          </h1>"
)

# 4. Make nav-tabs glass-nav
content = content.replace("className=\"nav-tabs\"", "className=\"nav-tabs glass-nav\"")

# 5. Convert section/div className="panel" into TiltCard where appropriate
# Wait, replacing all `<section className="panel"` with `<TiltCard className="panel"` might break things if closing tags don't match.
# Let's target specific main panels in the overview and fleet tabs instead of all panels.
# Or just replace all `<div className="panel">` and `<section className="panel">` with `<div className="panel spotlight-card">` instead of full TiltCard, because TiltCard might be too aggressive for forms.
# Let's just append "spotlight-card" to all panels so they get the mouse hover glow.
# Wait, spotlight-card requires tracking mouse X/Y which is only handled if we have the onMouseMove event.
# So let's write a wrapper. Instead of full TiltCard for everything, let's just make the primary buttons use animated-border.

content = content.replace(
    "<button onClick={() => applyPreset('normal')}>NORMAL ($0.01)</button>",
    "<button onClick={() => applyPreset('normal')} className=\"animated-border\"><span style={{position:'relative', zIndex: 2}}>NORMAL ($0.01)</span></button>"
)

content = content.replace(
    "<button onClick={sendChatMessage} disabled={isSending || !userPrompt.trim()} className=\"purple\">\n                        {isSending ? 'SENDING...' : 'SEND MESSAGE'} <Send size={14} style={{ marginLeft: \"6px\" }} />\n                      </button>",
    "<button onClick={sendChatMessage} disabled={isSending || !userPrompt.trim()} className=\"purple animated-border\">\n                        <span style={{position:'relative', zIndex: 2, display: 'flex', alignItems: 'center'}}>{isSending ? 'SENDING...' : 'SEND MESSAGE'} <Send size={14} style={{ marginLeft: \"6px\" }} /></span>\n                      </button>"
)

# Apply glass-nav to header as well
content = content.replace(
    "<header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>",
    "<header className=\"glass-nav\" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 0, paddingBottom: '16px', zIndex: 51 }}>"
)

with open('src/pages/Dashboard.tsx', 'w') as f:
    f.write(content)

print("Dashboard styles updated")
