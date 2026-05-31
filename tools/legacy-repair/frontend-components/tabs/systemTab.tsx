import { useAppStore } from '../../hooks/useAppStore';
import { api } from '../../services/api';

export function systemTab(props: ReturnType<typeof useAppStore>) {
  const {
    tps,
    cpuUsage,
    ramUsage,
    modelPriority,
    setModelPriority,
    backendStatus,
    backendLogs,
    handleCheckBackendHealth,
    handleRestartBackend,
    handleStopBackend,
    handleOpenBackendLogs,
    handleResetBackendRuntime,
    formAutoStart,
    setFormAutoStart,
    formAutoRestart,
    setFormAutoRestart,
    formStopOnExit,
    setFormStopOnExit,
    formPort,
    setFormPort,
    formBindAddress,
    setFormBindAddress,
    formMaxRestarts,
    setFormMaxRestarts,
    formBackoffPolicy,
    setFormBackoffPolicy,
    editAllowedTools,
    setEditAllowedTools,
    formBinaryPath,
    setFormBinaryPath,
    formLogPath,
    setFormLogPath,
    handleSaveBackendConfig,
    blackboardInput,
    setBlackboardInput,
    camelidUrl,
    setCamelidUrl,
    ollamaUrl,
    setOllamaUrl,
    openaiKey,
    setOpenaiKey,
    anthropicKey,
    setAnthropicKey,
    handleSaveSettings
  } = props;

  return (
    <div className="system-container" style={{
      flex: 1,
      overflowY: "auto",
      padding: "24px",
      display: "flex",
      flexDirection: "column",
      gap: "24px"
    }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        gap: "16px"
      }}>
        
        {/* Telemetry Card 1 */}
        <div style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid var(--border-color)",
          borderRadius: "14px",
          padding: "20px"
        }}>
          <h4 style={{
            fontSize: "0.8rem",
            textTransform: "uppercase",
            color: "var(--text-muted)",
            fontWeight: 700,
            letterSpacing: "0.5px",
            marginBottom: "12px"
          }}>🧠 Local Inference (Camelid Runtime Engine)</h4>
          <div style={{
            fontSize: "2rem",
            fontWeight: 700,
            display: "flex",
            alignItems: "baseline",
            gap: "6px"
          }}>
            {tps} <span style={{
              fontSize: "0.85rem",
              color: "var(--text-muted)",
              fontWeight: 500
            }}>tok/sec</span>
          </div>
          <div style={{
            marginTop: "12px"
          }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "0.72rem",
              color: "var(--text-muted)",
              marginBottom: "4px"
            }}>
              <span>Metal GPU Offloading</span>
              <span>100% Core GPU</span>
            </div>
            <div style={{
              height: "6px",
              background: "rgba(255,255,255,0.05)",
              borderRadius: "3px",
              overflow: "hidden"
            }}>
              <div style={{
                height: "100%",
                background: "linear-gradient(90deg, #10b981, #00f2fe)",
                width: "100%"
              }} />
            </div>
          </div>
          <div style={{
            marginTop: "12px",
            borderTop: "1px solid rgba(255,255,255,0.04)",
            paddingTop: "8px",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            fontSize: "0.75rem"
          }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between"
            }}>
              <span style={{
                color: "var(--text-muted)"
              }}>Engine Daemon:</span>
              <span style={{
                color: "var(--color-working)",
                fontWeight: 600
              }}>ACTIVE (Port 8181)</span>
            </div>
            <div style={{
              display: "flex",
              justifyContent: "space-between"
            }}>
              <span style={{
                color: "var(--text-muted)"
              }}>GGUF Format:</span>
              <span>Llama 3.2 3B Instruct</span>
            </div>
          </div>
        </div>

        {/* Telemetry Card 2 */}
        <div style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid var(--border-color)",
          borderRadius: "14px",
          padding: "20px"
        }}>
          <h4 style={{
            fontSize: "0.8rem",
            textTransform: "uppercase",
            color: "var(--text-muted)",
            fontWeight: 700,
            letterSpacing: "0.5px",
            marginBottom: "12px"
          }}>💻 Host CPU Thread Pool</h4>
          <div style={{
            fontSize: "2rem",
            fontWeight: 700
          }}>{cpuUsage}%</div>
          <div style={{
            marginTop: "12px"
          }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "0.72rem",
              color: "var(--text-muted)",
              marginBottom: "4px"
            }}>
              <span>Tokio Concurrency Load</span>
              <span>Watchdog Active</span>
            </div>
            <div style={{
              height: "6px",
              background: "rgba(255,255,255,0.05)",
              borderRadius: "3px",
              overflow: "hidden"
            }}>
              <div style={{
                height: "100%",
                background: "var(--accent-primary)",
                width: `${cpuUsage}%`,
                transition: "width 0.5s ease"
              }} />
            </div>
          </div>
          <div style={{
            marginTop: "12px",
            borderTop: "1px solid rgba(255,255,255,0.04)",
            paddingTop: "8px",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            fontSize: "0.75rem"
          }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between"
            }}>
              <span style={{
                color: "var(--text-muted)"
              }}>Watchdog Loop:</span>
              <span>5000ms Sleep</span>
            </div>
            <div style={{
              display: "flex",
              justifyContent: "space-between"
            }}>
              <span style={{
                color: "var(--text-muted)"
              }}>Active Threads:</span>
              <span>4 Async Pools</span>
            </div>
          </div>
        </div>

        {/* Telemetry Card 3 */}
        <div style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid var(--border-color)",
          borderRadius: "14px",
          padding: "20px"
        }}>
          <h4 style={{
            fontSize: "0.8rem",
            textTransform: "uppercase",
            color: "var(--text-muted)",
            fontWeight: 700,
            letterSpacing: "0.5px",
            marginBottom: "12px"
          }}>💾 OS Memory Allocations</h4>
          <div style={{
            fontSize: "2rem",
            fontWeight: 700,
            display: "flex",
            alignItems: "baseline",
            gap: "6px"
          }}>
            {ramUsage} <span style={{
              fontSize: "0.85rem",
              color: "var(--text-muted)",
              fontWeight: 500
            }}>GB</span>
          </div>
          <div style={{
            marginTop: "12px"
          }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "0.72rem",
              color: "var(--text-muted)",
              marginBottom: "4px"
            }}>
              <span>RAM Allocated (OS + Model)</span>
              <span>{(ramUsage / 16.0 * 100).toFixed(1)}%</span>
            </div>
            <div style={{
              height: "6px",
              background: "rgba(255,255,255,0.05)",
              borderRadius: "3px",
              overflow: "hidden"
            }}>
              <div style={{
                height: "100%",
                background: "var(--accent-secondary)",
                width: `${ramUsage / 16.0 * 100}%`,
                transition: "width 0.5s ease"
              }} />
            </div>
          </div>
          <div style={{
            marginTop: "12px",
            borderTop: "1px solid rgba(255,255,255,0.04)",
            paddingTop: "8px",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            fontSize: "0.75rem"
          }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between"
            }}>
              <span style={{
                color: "var(--text-muted)"
              }}>Total System RAM:</span>
              <span>16.00 GB</span>
            </div>
            <div style={{
              display: "flex",
              justifyContent: "space-between"
            }}>
              <span style={{
                color: "var(--text-muted)"
              }}>Swap Memory:</span>
              <span>0.00 GB</span>
            </div>
          </div>
        </div>

      </div>

      {/* Model Failover/Priority Sequences */}
      <div style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid var(--border-color)",
        borderRadius: "14px",
        padding: "20px"
      }}>
        <h3 style={{
          fontSize: "0.95rem",
          fontWeight: 700,
          color: "var(--accent-primary)",
          marginBottom: "6px"
        }}>🤖 Dynamic Model Failover Sequence</h3>
        <p style={{
          fontSize: "0.8rem",
          color: "var(--text-muted)",
          marginBottom: "16px",
          lineHeight: 1.4
        }}>If a model provider fails (e.g. cloud rate limits or daemon swap latency), Cameleer will autonomously cascade tasks down the priority chain:</p>
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px"
        }}>
          {modelPriority.map((model, idx) => <div key={idx} style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderRadius: "10px",
            background: idx === 0 ? "rgba(0,242,254,0.05)" : "rgba(255,255,255,0.01)",
            border: idx === 0 ? "1px solid rgba(0,242,254,0.25)" : "1px solid var(--border-color)"
          }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "12px"
            }}>
              <span style={{
                fontSize: "0.85rem",
                fontWeight: 700,
                color: idx === 0 ? "var(--accent-primary)" : "var(--text-muted)"
              }}>#{idx + 1}</span>
              <div>
                <div style={{
                  fontSize: "0.85rem",
                  fontWeight: 600
                }}>{model}</div>
                <div style={{
                  fontSize: "0.7rem",
                  color: "var(--text-muted)",
                  marginTop: "1px"
                }}>
                  {idx === 0 ? "ACTIVE PRIMARY - Camelid GGUF GPU" : idx === 1 ? "STANDBY LOCAL GGUF" : "CLOUD API FAILOVER"}
                </div>
              </div>
            </div>
            <div style={{
              display: "flex",
              gap: "6px"
            }}>
              {idx > 0 && <button onClick={() => {
                const newP = [...modelPriority];
                const temp = newP[idx];
                newP[idx] = newP[idx - 1];
                newP[idx - 1] = temp;
                setModelPriority(newP);
              }} style={{
                background: "rgba(255,255,255,0.04)",
                border: "none",
                color: "#fff",
                width: "24px",
                height: "24px",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "0.7rem"
              }}>
                ▲
              </button>}
              {idx < modelPriority.length - 1 && <button onClick={() => {
                const newP = [...modelPriority];
                const temp = newP[idx];
                newP[idx] = newP[idx + 1];
                newP[idx + 1] = temp;
                setModelPriority(newP);
              }} style={{
                background: "rgba(255,255,255,0.04)",
                border: "none",
                color: "#fff",
                width: "24px",
                height: "24px",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "0.7rem"
              }}>
                ▼
              </button>}
            </div>
          </div>)}
        </div>
      </div>

      {/* Backend Runtime Supervisor Control & Telemetry Panel */}
      <div style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid var(--border-color)",
        borderRadius: "14px",
        padding: "20px",
        marginTop: "16px"
      }}>
        <h3 style={{
          fontSize: "0.95rem",
          fontWeight: 700,
          color: "var(--accent-primary)",
          marginBottom: "6px"
        }}>🔌 Backend Runtime Supervisor</h3>
        <p style={{
          fontSize: "0.8rem",
          color: "var(--text-muted)",
          marginBottom: "16px",
          lineHeight: 1.4
        }}>
          Monitor status and modify supervisor policies for the local GGUF inference engine daemon (Camelid Runtime). Single source of truth.
        </p>

        {/* Status details sub-card */}
        <div style={{
          background: "rgba(0,0,0,0.15)",
          border: "1px solid var(--border-color)",
          borderRadius: "10px",
          padding: "16px",
          marginBottom: "16px"
        }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "16px",
            fontSize: "0.8rem"
          }}>
            <div>
              <span style={{
                color: "var(--text-muted)",
                display: "block",
                fontSize: "0.7rem",
                textTransform: "uppercase",
                marginBottom: "2px"
              }}>SUPERVISED STATUS</span>
              <span style={{
                fontWeight: 700,
                color: backendStatus?.state === "ready" ? "var(--color-working)" : ["starting", "restarting"].includes(backendStatus?.state || "") ? "var(--color-blocked)" : "#ef4444",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}>
                <span style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: backendStatus?.state === "ready" ? "var(--color-working)" : ["starting", "restarting"].includes(backendStatus?.state || "") ? "var(--color-blocked)" : "#ef4444",
                  boxShadow: `0 0 8px ${backendStatus?.state === "ready" ? "var(--color-working)" : ["starting", "restarting"].includes(backendStatus?.state || "") ? "var(--color-blocked)" : "#ef4444"}`
                }} />
                {backendStatus?.state ? backendStatus.state.toUpperCase() : "UNKNOWN"}
              </span>
            </div>
            <div>
              <span style={{
                color: "var(--text-muted)",
                display: "block",
                fontSize: "0.7rem",
                textTransform: "uppercase",
                marginBottom: "2px"
              }}>PROCESS ID (PID)</span>
              <span style={{
                fontWeight: 600
              }}>{backendStatus?.pid || "None"}</span>
            </div>
            <div>
              <span style={{
                color: "var(--text-muted)",
                display: "block",
                fontSize: "0.7rem",
                textTransform: "uppercase",
                marginBottom: "2px"
              }}>ACTIVE PORT / BIND</span>
              <span style={{
                fontWeight: 600
              }}>{backendStatus?.bind_address || "127.0.0.1"}:{backendStatus?.port || 8181}</span>
            </div>
            <div>
              <span style={{
                color: "var(--text-muted)",
                display: "block",
                fontSize: "0.7rem",
                textTransform: "uppercase",
                marginBottom: "2px"
              }}>ENGINE VERSION</span>
              <span style={{
                fontWeight: 600
              }}>{backendStatus?.version || "N/A"}</span>
            </div>
            <div>
              <span style={{
                color: "var(--text-muted)",
                display: "block",
                fontSize: "0.7rem",
                textTransform: "uppercase",
                marginBottom: "2px"
              }}>ACTIVE MODEL</span>
              <span style={{
                fontWeight: 600,
                color: "var(--accent-primary)"
              }}>{backendStatus?.active_model || "None"}</span>
            </div>
            <div>
              <span style={{
                color: "var(--text-muted)",
                display: "block",
                fontSize: "0.7rem",
                textTransform: "uppercase",
                marginBottom: "2px"
              }}>MODEL LOADED</span>
              <span style={{
                fontWeight: 600,
                color: backendStatus?.model_loaded ? "var(--color-working)" : "var(--text-muted)"
              }}>
                {backendStatus?.model_loaded ? "YES" : "NO"}
              </span>
            </div>
            <div>
              <span style={{
                color: "var(--text-muted)",
                display: "block",
                fontSize: "0.7rem",
                textTransform: "uppercase",
                marginBottom: "2px"
              }}>RESTART ATTEMPTS</span>
              <span style={{
                fontWeight: 600,
                color: (backendStatus?.restart_count || 0) > 0 ? "var(--color-blocked)" : "var(--text-main)"
              }}>
                {backendStatus?.restart_count || 0} / 5
              </span>
            </div>
            <div>
              <span style={{
                color: "var(--text-muted)",
                display: "block",
                fontSize: "0.7rem",
                textTransform: "uppercase",
                marginBottom: "2px"
              }}>LAST HEALTH CHECK</span>
              <span style={{
                fontWeight: 600,
                fontSize: "0.75rem"
              }}>
                {backendStatus?.last_health_check_at ? new Date(parseInt(backendStatus.last_health_check_at) * 1000).toLocaleTimeString() : "Never"}
              </span>
            </div>
          </div>
          
          {backendStatus?.last_error && <div style={{
            marginTop: "12px",
            padding: "10px",
            background: "rgba(239, 68, 68, 0.08)",
            border: "1px solid rgba(239, 68, 68, 0.2)",
            borderRadius: "6px",
            fontSize: "0.75rem",
            color: "#f87171"
          }}>
            <span style={{
              fontWeight: 700
            }}>Last Error:</span> {backendStatus.last_error}
          </div>}
          
          <div style={{
            marginTop: "12px",
            fontSize: "0.72rem",
            color: "var(--text-muted)",
            borderTop: "1px solid rgba(255,255,255,0.05)",
            paddingTop: "8px"
          }}>
            <span style={{
              fontWeight: 600
            }}>Log File Location:</span> <code style={{
              color: "var(--accent-secondary)",
              fontFamily: "var(--font-mono)"
            }}>{backendStatus?.log_path || "~/.cameleer/camelid.log"}</code>
          </div>
        </div>

        {/* Log stream view inside settings */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          textAlign: "left",
          marginBottom: "16px"
        }}>
          <span style={{
            fontSize: "0.75rem",
            textTransform: "uppercase",
            color: "var(--text-muted)",
            fontWeight: 700,
            letterSpacing: "0.5px"
          }}>Live Log Console Stream</span>
          <pre style={{
            background: "rgba(0,0,0,0.4)",
            border: "1px solid var(--border-color)",
            borderRadius: "10px",
            padding: "12px",
            fontSize: "0.75rem",
            color: "#34d399",
            fontFamily: "var(--font-mono)",
            maxHeight: "130px",
            overflowY: "auto",
            whiteSpace: "pre-wrap",
            margin: 0,
            lineHeight: 1.4
          }}>
            {backendLogs || "No logs streams piped yet."}
          </pre>
        </div>

        {/* Action Buttons Row */}
        <div style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "10px",
          marginBottom: "20px",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          paddingBottom: "16px"
        }}>
          <button onClick={handleCheckBackendHealth} className="action-btn">
            🔄 Check Status
          </button>
          <button onClick={handleRestartBackend} className="action-btn" style={{
            background: "rgba(16, 185, 129, 0.1)",
            borderColor: "rgba(16, 185, 129, 0.25)",
            color: "#10b981"
          }}>
            🚀 Restart Backend
          </button>
          <button onClick={handleStopBackend} className="action-btn danger-btn">
            🛑 Stop Backend
          </button>
          <button onClick={handleOpenBackendLogs} className="action-btn">
            📂 Open Logs
          </button>
          <button onClick={async () => {
            try {
              await api.revealBackendBinary();
            } catch (e) {
              (window as any).toast("Failed to reveal binary: " + e);
            }
          }} className="action-btn">
            🔍 Reveal Backend Binary
          </button>
          <button onClick={async () => {
            try {
              const res: any = await api.verifyPackagedRuntime();
              alert(`RUNTIME VERIFICATION\n\nFound: ${res.found}\nPath: ${res.resolved_path}\nExecutable: ${res.executable}\nVersion: ${res.version_output || "Unknown"}\n\nSearched: \n${res.searched_paths.join("\n")}\n\nError: ${res.error_message || "None"}`);
            } catch (e) {
              alert("Error verifying runtime: " + e);
            }
          }} className="action-btn">
            🧪 Run System Diagnostics
          </button>
          <button onClick={handleResetBackendRuntime} className="action-btn danger-btn" style={{
            marginLeft: "auto"
          }}>
            ⚠️ Reset Runtime State
          </button>
        </div>

        {/* Configuration Fields Grid */}
        <h4 style={{
          fontSize: "0.85rem",
          fontWeight: 700,
          color: "var(--text-main)",
          marginBottom: "12px"
        }}>⚙️ Supervisor Policies</h4>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
          marginBottom: "16px"
        }}>
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            justifyContent: "center"
          }}>
            <label style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "0.82rem",
              cursor: "pointer",
              userSelect: "none"
            }}>
              <input type="checkbox" checked={formAutoStart} onChange={e => setFormAutoStart(e.target.checked)} style={{
                cursor: "pointer"
              }} />
              Auto-start backend on app launch
            </label>
            <label style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "0.82rem",
              cursor: "pointer",
              userSelect: "none"
            }}>
              <input type="checkbox" checked={formAutoRestart} onChange={e => setFormAutoRestart(e.target.checked)} style={{
                cursor: "pointer"
              }} />
              Auto-restart backend if it crashes
            </label>
            <label style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "0.82rem",
              cursor: "pointer",
              userSelect: "none"
            }}>
              <input type="checkbox" checked={formStopOnExit} onChange={e => setFormStopOnExit(e.target.checked)} style={{
                cursor: "pointer"
              }} />
              Stop backend when Cameleer closes
            </label>
          </div>
          
          <div className="form-group">
            <label className="form-label">Backend Port</label>
            <input type="number" className="form-input" value={formPort} onChange={e => setFormPort(parseInt(e.target.value) || 8181)} />
          </div>

          <div className="form-group">
            <label className="form-label">Bind Address</label>
            <input type="text" className="form-input" value={formBindAddress} onChange={e => setFormBindAddress(e.target.value)} placeholder="127.0.0.1" />
          </div>

          <div className="form-group">
            <label className="form-label">Max Crash Restarts (2 min window)</label>
            <input type="number" className="form-input" value={formMaxRestarts} onChange={e => setFormMaxRestarts(parseInt(e.target.value) || 5)} />
          </div>

          <div className="form-group">
            <label className="form-label">Restart Backoff Policy</label>
            <select className="form-input" value={formBackoffPolicy} onChange={e => setFormBackoffPolicy(e.target.value)} style={{
              background: "rgba(0, 0, 0, 0.3)",
              color: "#fff"
            }}>
              <option value="exponential">Exponential Backoff</option>
              <option value="linear">Linear Backoff</option>
            </select>
          </div>
        </div>

        {/* OS Gateway & Advanced Section */}
        <details style={{
          background: "rgba(255,255,255,0.01)",
          border: "1px solid var(--border-color)",
          borderRadius: "10px",
          padding: "12px",
          marginBottom: "16px"
        }}>
          <summary style={{
            fontSize: "0.8rem",
            fontWeight: 700,
            color: "var(--text-muted)",
            cursor: "pointer",
            userSelect: "none"
          }}>
            🛠️ Developer / Advanced Options (Overhead overrides)
          </summary>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "16px",
            marginTop: "12px"
          }}>
            <div className="form-group" style={{
              margin: 0
            }}>
              <label className="form-label">Backend Binary Path (Leave empty for default bundled)</label>
              <input type="text" className="form-input" value={formBinaryPath} onChange={e => setFormBinaryPath(e.target.value)} placeholder="e.g. /usr/local/bin/camelid" />
            </div>
            <div className="form-group" style={{
              margin: 0
            }}>
              <label className="form-label">Custom Log Path (Leave empty for default ~/.cameleer/camelid.log)</label>
              <input type="text" className="form-input" value={formLogPath} onChange={e => setFormLogPath(e.target.value)} placeholder="e.g. /var/log/camelid.log" />
            </div>
          </div>
        </details>

        <div style={{
          display: "flex",
          justifyContent: "flex-end"
        }}>
          <button className="sidebar-btn" style={{
            margin: 0,
            padding: "10px 24px"
          }} onClick={handleSaveBackendConfig}>
            Save Supervisor Config
          </button>
        </div>
      </div>

      {/* OS Gateway & Camelid Configurations */}
      <div style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid var(--border-color)",
        borderRadius: "14px",
        padding: "20px",
        marginTop: "16px"
      }}>
        <h3 style={{
          fontSize: "0.95rem",
          fontWeight: 700,
          color: "var(--accent-primary)",
          marginBottom: "6px"
        }}>⚙️ OS Gateway & Camelid Runtime Configurations</h3>
        <p style={{
          fontSize: "0.8rem",
          color: "var(--text-muted)",
          marginBottom: "16px",
          lineHeight: 1.4
        }}>Configure active connection gateways, local GGUF Metal endpoints, and cloud keys to power your local agent crew.</p>
        
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px"
        }}>
          <div className="form-group">
            <label className="form-label">Global Goal Blackboard</label>
            <input className="form-input" value={blackboardInput} onChange={e => setBlackboardInput(e.target.value)} placeholder="e.g. Save hello.rs to my Desktop" />
          </div>
          <div className="form-group">
            <label className="form-label">Camelid GGUF Endpoint</label>
            <input className="form-input" value={camelidUrl} onChange={e => setCamelidUrl(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Ollama API URL</label>
            <input className="form-input" value={ollamaUrl} onChange={e => setOllamaUrl(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">OpenAI Key (Cloud)</label>
            <input type="password" className="form-input" value={openaiKey} onChange={e => setOpenaiKey(e.target.value)} placeholder="sk-..." />
          </div>
          <div className="form-group">
            <label className="form-label">Anthropic Key (Cloud)</label>
            <input type="password" className="form-input" value={anthropicKey} onChange={e => setAnthropicKey(e.target.value)} placeholder="sk-ant-..." />
          </div>
        </div>
        
        <div style={{
          display: "flex",
          justifyContent: "flex-end",
          marginTop: "16px"
        }}>
          <button className="sidebar-btn" style={{
            margin: 0,
            padding: "10px 24px"
          }} onClick={handleSaveSettings}>
            Save OS Settings
          </button>
        </div>
      </div>

    </div>
  );
}
