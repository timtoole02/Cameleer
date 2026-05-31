import re
import os

with open('src/App.tsx', 'r') as f:
    lines = f.readlines()

out_dir = 'src/components/tabs'
os.makedirs(out_dir, exist_ok=True)

# Find the big ternary blocks
tabs = [
    ("dashboard", "DashboardTab"),
    ("global", "ChatTab"),  # includes dm and org_dashboard
    ("kanban", "KanbanTab"),
    ("runs", "RunsTab"),
    ("skills", "SkillsTab"),
    ("channels", "ChannelsTab"),
    ("files", "FilesTab"),
    ("missions", "MissionsTab"),
    ("agents", "AgentsTab"),
    ("models", "ModelsTab")
]

start_line = -1
for i, line in enumerate(lines):
    if '{activeTab === "dashboard" ? (' in line:
        start_line = i
        break

print(f"Start line: {start_line}")

