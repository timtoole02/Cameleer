import sys

with open("src/storage.rs", "r") as f:
    lines = f.readlines()

new_lines = []
in_init_db = False
for line in lines:
    if line.startswith("pub fn init_db(conn: &Connection) -> Result<()> {"):
        in_init_db = True
        new_lines.append("pub fn init_db(conn: &Connection) -> Result<()> {\n")
        new_lines.append("    // Phase 2 Wipe: Drop all existing tables to guarantee a clean state.\n")
        new_lines.append("    let _ = conn.execute_batch(\n")
        new_lines.append("        \"PRAGMA writable_schema = 1;\n")
        new_lines.append("         DELETE FROM sqlite_master WHERE type IN ('table', 'index', 'trigger');\n")
        new_lines.append("         PRAGMA writable_schema = 0;\n")
        new_lines.append("         VACUUM;\n")
        new_lines.append("         PRAGMA integrity_check;\"\n")
        new_lines.append("    );\n")
        new_lines.append("\n")
        new_lines.append("    let schema = include_str!(\"schema.sql\");\n")
        new_lines.append("    conn.execute_batch(schema)?;\n")
        new_lines.append("    Ok(())\n")
        new_lines.append("}\n")
    elif in_init_db:
        if line.startswith("pub fn seed_default_agents"):
            in_init_db = False
            new_lines.append(line)
    else:
        new_lines.append(line)

with open("src/storage.rs", "w") as f:
    f.writelines(new_lines)

