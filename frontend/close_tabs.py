import re

with open('src/main.tsx', 'r') as f:
    content = f.read()

# We need to add </motion.div> right before the `)}` that closes each tab.
# Tab ends are immediately before the next tab comment or before the modal comment.
# Let's find these boundaries:
# 1. `{/* TAB 1:`
# 2. `{/* TAB 2:`
# 3. `{/* TAB 3:`
# 4. `{/* TAB 4:`
# 5. `</AnimatePresence>` (since we just added this)

replacements = [
    ("      )}\n\n      {/* TAB 1:", "        </motion.div>\n      )}\n\n      {/* TAB 1:"),
    ("      )}\n\n      {/* TAB 2:", "        </motion.div>\n      )}\n\n      {/* TAB 2:"),
    ("      )}\n\n      {/* TAB 3:", "        </motion.div>\n      )}\n\n      {/* TAB 3:"),
    ("      )}\n\n      {/* TAB 4:", "        </motion.div>\n      )}\n\n      {/* TAB 4:"),
    ("      )}\n      </AnimatePresence>", "        </motion.div>\n      )}\n      </AnimatePresence>")
]

for old, new in replacements:
    content = content.replace(old, new, 1)

with open('src/main.tsx', 'w') as f:
    f.write(content)

print("Added </motion.div> to close tab wrappers")
