import re
import os

hooks = ["useBoard", "useChat", "useAgents", "useModels"]

for hook in hooks:
    path = f"src/hooks/{hook}.ts"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    
    # Rename function
    content = content.replace("export default function App() {", f"export function {hook}() {{")
    
    # Remove JSX return block
    # We find the main return block: it starts with `return (` near the end of the state/functions definitions.
    # To be safe, we look for the last `return (` that starts at a 2-space indent
    match = re.search(r'\n  return \(\n\s+<div className="app-container"', content)
    if match:
        content = content[:match.start()] + "\n  return {};\n}\n"
    else:
        print(f"Could not find return block in {hook}")
        
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Processed {hook}")

