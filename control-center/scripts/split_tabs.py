import re

with open("src/App.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Find the main return block
start_idx = content.find("return (")
if start_idx == -1:
    print("Could not find return block")
    exit(1)

body = content[start_idx:]

# The tabs are structured like: `) : activeTab === "xyz" ? (` or `{activeTab === "xyz" ? (`
tabs = [
    "dashboard", "global", "dm", "kanban", "runs", "skills", 
    "channels", "files", "missions", "agents", "models", "system", "org_dashboard"
]

import os
os.makedirs("src/components/tabs", exist_ok=True)

for tab in tabs:
    # A very naive search to find the start of the tab's JSX
    # This might fail on nested ternary, but let's see.
    pattern = rf'activeTab === "{tab}"(\s*&&\s*activeOrgNode)?\s*\?\s*\('
    match = re.search(pattern, body)
    if match:
        print(f"Found start of {tab}")
    else:
        print(f"Could not find {tab}")

