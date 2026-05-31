# Known Broken Flows

Currently, there are no known completely broken flows in the core lifecycle. 
Sprint 3 successfully bridged the gap between backend validation and frontend receipt rendering. 

## Areas for Further Hardening
- **Agent Sandbox Edge Cases**: "Moderate" and "Loose" safety profiles might still block valid chained bash scripts if not parsed correctly.
- **Recovery Loops**: If an agent continually fails validation, we need a better frontend UI notification indicating a "Stuck Task" or "Agent Assistance Required" flag.
