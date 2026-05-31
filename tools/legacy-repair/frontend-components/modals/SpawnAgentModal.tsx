import { useAppStore } from '../../hooks/useAppStore';

export function SpawnAgentModal(props: ReturnType<typeof useAppStore>) {
  const {
    isSpawnModalOpen,
    setIsSpawnModalOpen,
    handleSpawnAgent,
    spawnName,
    setSpawnName,
    spawnRole,
    setSpawnRole,
    spawnPersona,
    setSpawnPersona,
    spawnProvider,
    setSpawnProvider,
    spawnModel,
    setSpawnModel,
    spawnContinuous,
    setSpawnContinuous,
    spawnParentAgentId,
    setSpawnParentAgentId,
    spawnAllowedTools,
    setSpawnAllowedTools,
    spawnTemp,
    setSpawnTemp,
    spawnMaxTokens,
    setSpawnMaxTokens,
    agents,
    localModels
  } = props;

  if (!isSpawnModalOpen) return null;

  return (
    <div className="modal-overlay">
      <form className="modal-content" onSubmit={handleSpawnAgent}>
        <div className="modal-title">🤖 Spawn Custom Agent Persona</div>
        
        <div className="form-group">
          <label className="form-label">Agent Name</label>
          <input className="form-input" required value={spawnName} onChange={e => setSpawnName(e.target.value)} placeholder="e.g. Sentry Analyst" />
        </div>

        <div className="form-group">
          <label className="form-label">Agent Role</label>
          <input className="form-input" required value={spawnRole} onChange={e => setSpawnRole(e.target.value)} placeholder="e.g. Quality Assurance Sentry" />
        </div>

        <div className="form-group">
          <label className="form-label">System Persona Description</label>
          <textarea className="form-input form-textarea" required value={spawnPersona} onChange={e => setSpawnPersona(e.target.value)} placeholder="Detailed behavioral persona rules..." />
        </div>

        <div className="form-group">
          <label className="form-label">Inference Provider</label>
          <select className="form-input" value={spawnProvider} onChange={e => {
            setSpawnProvider(e.target.value);
            if (e.target.value === "camelid") setSpawnModel("camelid-default");
            else if (e.target.value === "ollama") setSpawnModel("qwen2.5-coder");
            else if (e.target.value === "openai") setSpawnModel("gpt-4o");
            else if (e.target.value === "anthropic") setSpawnModel("claude-3-5-sonnet");
          }} style={{
            background: "#0a0d14",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "#fff"
          }}>
            <option value="camelid">Local Camelid GGUF</option>
            <option value="ollama">Ollama Local API</option>
            <option value="openai">OpenAI Cloud API</option>
            <option value="anthropic">Anthropic Claude API</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Model Name</label>
          {(() => {
            const camelidOptions = ["camelid-default", "tinyllama-1.1b-chat-v1.0.Q8_0.gguf", "Llama-3.2-1B-Instruct-Q8_0.gguf", "Llama-3.2-3B-Instruct-Q8_0.gguf", "Meta-Llama-3-8B-Instruct-Q8_0.gguf", "Mistral-7B-Instruct-v0.3.Q8_0.gguf", ...localModels];
            const uniqueCamelid = Array.from(new Set(camelidOptions));
            const ollamaOptions = ["qwen2.5-coder", "llama3.2", "llama3", "mistral", "deepseek-r1"];
            const openaiOptions = ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "o1-mini", "o1-preview"];
            const anthropicOptions = ["claude-3-5-sonnet", "claude-3-5-haiku", "claude-3-opus"];
            let opts: string[] = [];
            let defaultVal = "";
            if (spawnProvider === "camelid") {
              opts = uniqueCamelid;
              defaultVal = "camelid-default";
            } else if (spawnProvider === "ollama") {
              opts = ollamaOptions;
              defaultVal = "qwen2.5-coder";
            } else if (spawnProvider === "openai") {
              opts = openaiOptions;
              defaultVal = "gpt-4o";
            } else if (spawnProvider === "anthropic") {
              opts = anthropicOptions;
              defaultVal = "claude-3-5-sonnet";
            }
            const isCustom = spawnModel !== "" && !opts.includes(spawnModel);
            const selectValue = isCustom ? "__custom__" : spawnModel || defaultVal;
            return <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px"
            }}>
              <select className="form-input" value={selectValue} onChange={e => {
                if (e.target.value === "__custom__") {
                  setSpawnModel("");
                } else {
                  setSpawnModel(e.target.value);
                }
              }} style={{
                background: "#0a0d14",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#fff",
                height: "42px"
              }}>
                {opts.map(opt => <option key={opt} value={opt}>
                  {opt === "camelid-default" ? "camelid-default (System Active GGUF)" : opt}
                </option>)}
                {spawnProvider !== "camelid" && <option value="__custom__">✦ Custom Model Tag...</option>}
              </select>
              {(isCustom || selectValue === "__custom__") && <input className="form-input" required value={spawnModel} onChange={e => setSpawnModel(e.target.value)} placeholder="Type custom tag, e.g. llama3.2:1b" style={{
                marginTop: "4px"
              }} />}
            </div>;
          })()}
        </div>

        <div className="form-group" style={{
          flexDirection: "row",
          alignItems: "center",
          gap: "8px",
          marginTop: "4px"
        }}>
          <input type="checkbox" id="continuous-run" checked={spawnContinuous} onChange={e => setSpawnContinuous(e.target.checked)} style={{
            width: "16px",
            height: "16px",
            cursor: "pointer"
          }} />
          <label htmlFor="continuous-run" className="form-label" style={{
            cursor: "pointer",
            userSelect: "none",
            margin: 0
          }}>
            Continuous Autonomous Loop Execution
          </label>
        </div>

        <div className="form-group">
          <label className="form-label" style={{
            display: 'flex',
            justifyContent: 'space-between'
          }}>
            Parent Agent (Nesting)
            <span style={{
              fontSize: '0.7rem',
              color: 'var(--text-muted)'
            }}>(Optional)</span>
          </label>
          <select className="form-input" value={spawnParentAgentId} onChange={e => setSpawnParentAgentId(e.target.value)}>
            <option value="">-- No Parent (Root Level) --</option>
            {agents.map(a => <option key={a.id} value={a.id}>{a.name} ({a.role})</option>)}
          </select>
          <p style={{
            fontSize: "0.75rem",
            color: "var(--text-muted)",
            marginTop: "4px"
          }}>
            Agent will inherit rules and report to this parent agent.
          </p>
        </div>

        <div className="form-group" style={{
          padding: "12px",
          background: "rgba(0,0,0,0.2)",
          borderRadius: "8px",
          border: "1px solid var(--border-color)"
        }}>
          <label className="form-label">Allowed Tools Sandbox</label>
          <p style={{
            fontSize: "0.75rem",
            color: "var(--text-muted)",
            marginBottom: "8px"
          }}>Select the tools this agent is permitted to execute autonomously.</p>
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "8px"
          }}>
            {["task.create", "task.update", "task.move", "task.comment", "memory.search", "memory.write", "agent.handoff", "project.read", "project.update", "repo.search", "repo.read_file", "repo.propose_patch"].map(tool => <label key={tool} className="checkbox-label" style={{
              fontSize: "0.8rem"
            }}>
              <input type="checkbox" checked={spawnAllowedTools.includes(tool)} onChange={e => {
                if (e.target.checked) setSpawnAllowedTools([...spawnAllowedTools, tool]);
                else setSpawnAllowedTools(spawnAllowedTools.filter(t => t !== tool));
              }} /> {tool}
            </label>)}
          </div>
        </div>

        <div style={{
          display: "flex",
          gap: "16px"
        }}>
          <div className="form-group" style={{
            flex: 1
          }}>
            <label className="form-label">Temperature ({spawnTemp})</label>
            <input type="range" min="0.1" max="1.5" step="0.1" value={spawnTemp} onChange={e => setSpawnTemp(parseFloat(e.target.value))} />
          </div>

          <div className="form-group" style={{
            flex: 1
          }}>
            <label className="form-label">Max Tokens</label>
            <input type="number" className="form-input" value={spawnMaxTokens} onChange={e => setSpawnMaxTokens(parseInt(e.target.value))} />
          </div>
        </div>

        <div className="modal-buttons">
          <button type="button" className="action-btn" onClick={() => setIsSpawnModalOpen(false)}>
            Cancel
          </button>
          <button type="submit" className="sidebar-btn" style={{
            margin: 0
          }}>
            Launch Agent
          </button>
        </div>
      </form>
    </div>
  );
}
