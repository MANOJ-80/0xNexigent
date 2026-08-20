with open('src/styles.css', 'r') as f:
    content = f.read()

# Add Animated Border and Spotlight CSS
new_css = """
/* Glassmorphism */
.glass-nav {
  background: rgba(18, 18, 18, 0.6);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  position: sticky;
  top: 0;
  z-index: 50;
}

/* Animated Border Glow */
.animated-border {
  position: relative;
  background: var(--panel-bg);
  border-radius: var(--card-radius);
  z-index: 1;
}

.animated-border::before {
  content: "";
  position: absolute;
  top: -2px; left: -2px; right: -2px; bottom: -2px;
  background: conic-gradient(from 0deg, transparent 0%, transparent 60%, var(--purple) 80%, var(--green) 100%);
  z-index: -1;
  border-radius: calc(var(--card-radius) + 2px);
  animation: rotateBorder 4s linear infinite;
}

.animated-border::after {
  content: "";
  position: absolute;
  inset: 1px;
  background: var(--panel-bg);
  border-radius: var(--card-radius);
  z-index: -1;
}

@keyframes rotateBorder {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Text Reveal Gradient */
.text-gradient {
  background: linear-gradient(to right, #fff 20%, var(--purple) 40%, var(--green) 60%, #fff 80%);
  background-size: 200% auto;
  color: #000;
  background-clip: text;
  text-fill-color: transparent;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: shine 5s linear infinite;
}

@keyframes shine {
  to {
    background-position: 200% center;
  }
}

/* Spotlight Card Base */
.spotlight-card {
  position: relative;
  overflow: hidden;
}

.spotlight-card::before {
  content: "";
  position: absolute;
  top: var(--y, 0);
  left: var(--x, 0);
  width: 600px;
  height: 600px;
  background: radial-gradient(circle, rgba(122, 104, 255, 0.15) 0%, transparent 70%);
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 0;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.spotlight-card:hover::before {
  opacity: 1;
}
"""

content += new_css

with open('src/styles.css', 'w') as f:
    f.write(content)
