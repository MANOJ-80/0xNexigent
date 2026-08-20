import re

with open('src/main.tsx', 'r') as f:
    content = f.read()

# 1. Close the AnimatePresence tag before the first modal
# The first modal is `      {/* INSPECT AGENT DETAIL MODAL */}`
content = content.replace(
    "      {/* INSPECT AGENT DETAIL MODAL */}",
    "      </AnimatePresence>\n\n      {/* INSPECT AGENT DETAIL MODAL */}"
)

# 2. Fix the overview tab which has `<>` inside `<motion.div>`
# Find the end of overview tab. It ends right before `{/* TAB 2: FLEET`
# The current end of overview is:
#         </>
#       )}
# It was changed by our previous script to:
#         </>
#         </motion.div>
#       )}
content = content.replace(
    "        </>\n        </motion.div>\n      )}\n\n      {/* TAB 2:",
    "        </>\n        </motion.div>\n      )}\n\n      {/* TAB 2:"
)

# 3. Same for admin tab: it ends before the modal
# Wait, the end of admin tab is:
#         </>
#         </motion.div>
#       )}
content = content.replace(
    "        </>\n      )}\n\n      </AnimatePresence>\n\n      {/* INSPECT AGENT DETAIL MODAL */}",
    "        </>\n        </motion.div>\n      )}\n\n      </AnimatePresence>\n\n      {/* INSPECT AGENT DETAIL MODAL */}"
)

# Ensure no hanging `</AnimatePresence>` at the very end of file
content = content.replace("      </AnimatePresence>\n    </main>\n  );\n}", "    </main>\n  );\n}")


with open('src/main.tsx', 'w') as f:
    f.write(content)

print("Syntax fix applied.")
