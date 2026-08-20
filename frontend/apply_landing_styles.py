with open('src/pages/Landing.tsx', 'r') as f:
    content = f.read()

# Apply spotlight coordinates to TiltCard
tilt_card_replacement = """
const TiltCard = ({ children, style }: any) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  
  const mouseXSpring = useSpring(x, { stiffness: 300, damping: 30 });
  const mouseYSpring = useSpring(y, { stiffness: 300, damping: 30 });
  
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["10deg", "-10deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-10deg", "10deg"]);
  
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
      className="spotlight-card"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        ...style,
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
        perspective: 1000,
        position: 'relative',
        '--mouse-x': `${coords.x}px`,
        '--mouse-y': `${coords.y}px`
      } as any}
      variants={itemVariants}
      whileHover={{ scale: 1.02, boxShadow: "0 20px 40px rgba(122,104,255,0.2)", borderColor: "var(--purple)" }}
    >
      <div style={{ transform: "translateZ(30px)", position: 'relative', zIndex: 1 }}>
        {children}
      </div>
    </motion.article>
  );
};
"""

content = content.replace("const TiltCard = ({ children, style }: any) => {", "const TiltCard_MARKER = true;\n" + tilt_card_replacement)
content = content.replace(
    "const TiltCard_MARKER = true;\nconst TiltCard = ({ children, style }: any) => {",
    tilt_card_replacement
)
import re
content = re.sub(r"const TiltCard = \(\{ children, style \}: any\) => \{[\s\S]*?    </motion\.article>\n  \);\n\};\n", tilt_card_replacement, content)

# Add text-gradient to h1
content = content.replace(
    "<motion.h1 variants={itemVariants} animate={{ textShadow: ['0 0 20px rgba(122,104,255,0.2)', '0 0 60px rgba(122,104,255,0.6)', '0 0 20px rgba(122,104,255,0.2)'] }} transition={{ duration: 4, repeat: Infinity }} style={{ fontSize: '64px', marginBottom: '24px', textShadow: '0 0 40px rgba(122, 104, 255, 0.2)' }}>\n          Spend control <em>before</em> execution.\n        </motion.h1>",
    "<motion.h1 variants={itemVariants} animate={{ textShadow: ['0 0 20px rgba(122,104,255,0.2)', '0 0 60px rgba(122,104,255,0.6)', '0 0 20px rgba(122,104,255,0.2)'] }} transition={{ duration: 4, repeat: Infinity }} style={{ fontSize: '64px', marginBottom: '24px' }}>\n          <span className=\"text-gradient\">Spend control</span> <em>before</em> execution.\n        </motion.h1>"
)

# Make the deploy button an animated border button
content = content.replace(
    """<button 
            style={{ padding: '16px 32px', fontSize: '14px' }}
            onClick={() => navigate('/login')}
          >
            DEPLOY BUDGET PROXY ↗
          </button>""",
    """<button 
            className="animated-border"
            style={{ padding: '16px 32px', fontSize: '14px', border: 'none' }}
            onClick={() => navigate('/login')}
          >
            <span style={{ position: 'relative', zIndex: 2 }}>DEPLOY BUDGET PROXY ↗</span>
          </button>"""
)

with open('src/pages/Landing.tsx', 'w') as f:
    f.write(content)
