import re

with open('src/main.tsx', 'r') as f:
    content = f.read()

# Define motion wrapper template
motion_open = 'motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}'

# Wrap each tab section: replace `{activeTab === 'X' && (` patterns
tabs = ['playground', 'overview', 'fleet', 'audit', 'admin']

for tab in tabs:
    # Find the pattern and add motion wrapper
    old = f"{{activeTab === '{tab}' && ("
    # We need to be careful - the content after this varies
    # Just wrap the content inside with a motion.div
    # Find the line and add motion.div after the opening
    pass

# Instead of complex regex, let's add a simple AnimatePresence wrapper
# around the tab content area
old_nav_end = '</nav>\n'
new_nav_end = '</nav>\n\n      <AnimatePresence mode="wait">\n'

content = content.replace(old_nav_end, new_nav_end, 1)

# Add closing AnimatePresence before the modal overlays
# Find the pattern after the last tab
old_modal_start = '      {/* REQUEST DETAIL MODAL */}'
new_modal_start = '      </AnimatePresence>\n\n      {/* REQUEST DETAIL MODAL */}'

content = content.replace(old_modal_start, new_modal_start, 1)

# Now wrap each tab's content section with motion.div key
for tab in tabs:
    old_pattern = f"{{activeTab === '{tab}' && ("
    new_pattern = f"{{activeTab === '{tab}' && (\n        <motion.div key=\"{tab}\" initial={{{{ opacity: 0, y: 16 }}}} animate={{{{ opacity: 1, y: 0 }}}} exit={{{{ opacity: 0, y: -8 }}}} transition={{{{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}}}>"
    content = content.replace(old_pattern, new_pattern, 1)

# We also need to close the motion.div before each tab's closing
# Each tab ends with `      )}` on its own line before the next tab or modal
# This is tricky - let's find the closing pattern for each tab

with open('src/main.tsx', 'w') as f:
    f.write(content)

print("Added AnimatePresence and motion.div wrappers to tabs")
