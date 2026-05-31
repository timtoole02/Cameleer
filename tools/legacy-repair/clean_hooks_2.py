import os

hooks = ["useBoard", "useChat", "useAgents", "useModels"]

for hook in hooks:
    path = f"src/hooks/{hook}.ts"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    
    # Rename function
    content = content.replace("export default function App() {", f"export function {hook}() {{")
    
    # Truncate at return
    idx = content.find('  return (\n    <div className="app-layout">')
    if idx != -1:
        content = content[:idx] + "\n  return {};\n}\n"
    else:
        print(f"Failed to find split point in {hook}")
        
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Cleaned {hook}")

