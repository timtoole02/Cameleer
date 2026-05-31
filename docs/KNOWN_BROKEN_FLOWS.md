# Known Broken Flows

Currently, there are no known completely broken flows in the core lifecycle. 
Sprint 4 successfully eliminated the infinite recovery loop risk by introducing hard limits on validation failures (max 3), which gracefully transition tasks to a `Blocked` status requiring human/supervisor intervention.

## Areas for Further Hardening
- **Agent Sandbox Edge Cases**: "Moderate" and "Loose" safety profiles might still block valid chained bash scripts if not parsed correctly.
- **Concurrent Task Editing**: If two agents attempt to work on the exact same file simultaneously, there are no file-level locks.
