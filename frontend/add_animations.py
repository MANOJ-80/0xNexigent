import re

with open('src/pages/Landing.tsx', 'r') as f:
    content = f.read()

# Add Framer Motion useMotionValue, useSpring, useTransform
content = content.replace(
    "import { motion } from 'framer-motion';",
    "import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';\nimport { useEffect, useState } from 'react';"
)

# Add a 3D Tilt Card Component right before Landing function
tilt_card = """
const TiltCard = ({ children, style }: any) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  
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
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        ...style,
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
        perspective: 1000,
        position: 'relative'
      }}
      variants={itemVariants}
      whileHover={{ scale: 1.02, boxShadow: "0 20px 40px rgba(122,104,255,0.2)", borderColor: "var(--purple)" }}
    >
      <div style={{ transform: "translateZ(30px)" }}>
        {children}
      </div>
    </motion.article>
  );
};
"""

content = content.replace("export default function Landing() {", tilt_card + "\nexport default function Landing() {")

# Replace motion.article in the map with TiltCard
content = content.replace(
    "<motion.article key={i} variants={itemVariants} style={{ textAlign: 'left', padding: '32px' }}>",
    "<TiltCard key={i} style={{ textAlign: 'left', padding: '32px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--panel-border)', borderRadius: 'var(--card-radius)' }}>"
)

content = content.replace(
    "</motion.article>",
    "</TiltCard>"
)

# Add Floating Data Particles to the Background
background_particles = """
      {/* Floating 3D Data Particles */}
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ 
            x: Math.random() * window.innerWidth, 
            y: window.innerHeight + 100,
            opacity: Math.random() * 0.5 + 0.1
          }}
          animate={{
            y: -100,
            rotate: 360
          }}
          transition={{
            duration: Math.random() * 10 + 15,
            repeat: Infinity,
            ease: "linear"
          }}
          style={{
            position: 'absolute',
            width: Math.random() * 4 + 2 + 'px',
            height: Math.random() * 15 + 10 + 'px',
            background: i % 2 === 0 ? 'var(--purple)' : 'var(--green)',
            boxShadow: `0 0 10px ${i % 2 === 0 ? 'var(--purple-glow)' : 'var(--green-glow)'}`,
            zIndex: 0,
            opacity: 0.3
          }}
        />
      ))}
"""

content = content.replace(
    "{/* Background glowing effects */}",
    background_particles + "\n      {/* Background glowing effects */}"
)

# Add Glitch/Pulse effect to the main header
content = content.replace(
    "<motion.h1 variants={itemVariants} style={{ fontSize: '64px', marginBottom: '24px', textShadow: '0 0 40px rgba(122, 104, 255, 0.2)' }}>",
    "<motion.h1 variants={itemVariants} animate={{ textShadow: ['0 0 20px rgba(122,104,255,0.2)', '0 0 60px rgba(122,104,255,0.6)', '0 0 20px rgba(122,104,255,0.2)'] }} transition={{ duration: 4, repeat: Infinity }} style={{ fontSize: '64px', marginBottom: '24px', textShadow: '0 0 40px rgba(122, 104, 255, 0.2)' }}>"
)

with open('src/pages/Landing.tsx', 'w') as f:
    f.write(content)

print("Added advanced 3D animations to Landing.tsx")
