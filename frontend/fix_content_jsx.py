import re

with open('src/main.tsx', 'r') as f:
    content = f.read()

# Change ChatMessage content type
content = content.replace("content: string;", "content: string | React.ReactNode;")

# Fix line 483 filter logic to handle ReactNode and strip out system messages better
old_filter = ".filter(m => (m.role === 'user' || m.role === 'assistant') && !m.content.startsWith('<Sparkles size={14} style={{ marginRight: \"6px\", display: \"inline\" }} />'))"
new_filter = ".filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && !m.content.includes('[Reasoning Trace]'))"
content = content.replace(old_filter, new_filter)

# Fix map casting
content = content.replace(".map(m => ({ role: m.role, content: m.content })),", ".map(m => ({ role: m.role, content: m.content as string })),")

# We need to replace string literals with React Fragments. 
# We'll use regex to find `content: '...'` or `content: \`...\`` containing `<Icon `

def replace_string_to_fragment(match):
    prop = match.group(1) # 'content: ' or 'assistantText = '
    quote = match.group(2) # ' or `
    inner_html = match.group(3)
    # Convert string literal to a fragment
    if quote == "'":
        return f"{prop}<>{inner_html}</>"
    else:
        # It's a template literal. We need to convert it to a JSX fragment with expressions in braces.
        # e.g. `<Icon /> ${var}` -> `<><Icon /> {var}</>`
        inner_jsx = re.sub(r'\$\{([^}]+)\}', r'{\1}', inner_html)
        return f"{prop}<>{inner_jsx}</>"

# Match content: '<Icon ... /> ...'
content = re.sub(r"(content:\s*)(['`])(<[A-Za-z]+ size=\{14\}[^>]*/>.*?)\2", replace_string_to_fragment, content)

# Match assistantText = `<Icon ... /> ...`
content = re.sub(r"(assistantText = )(['`])(<[A-Za-z]+ size=\{14\}[^>]*/>.*?)\2", replace_string_to_fragment, content)

with open('src/main.tsx', 'w') as f:
    f.write(content)

print("Fixed JSX string literals in content fields.")
