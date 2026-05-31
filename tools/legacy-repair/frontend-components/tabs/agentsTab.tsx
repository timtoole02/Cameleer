import { useAppStore } from '../../hooks/useAppStore';

export function agentsTab(props: ReturnType<typeof useAppStore>) {
  const { activeTab, setActiveTab, kanbanView, setKanbanView, refreshKanban, setRefreshKanban, suggestions, setSuggestions, templates, setTemplates, selectedTemplateKey, setSelectedTemplateKey, wizardCustomName, setWizardCustomName, decomposingTaskId, setDecomposingTaskId, decomposedProposals, setDecomposedProposals, localModels, setLocalModels, activeModel, setActiveModel, downloadState, setDownloadState, editAgentId, setEditAgentId, editName, setEditName, editRole, setEditRole, editPersona, setEditPersona, editProvider, setEditProvider, editModelName, setEditModelName, editTemp, setEditTemp, editMaxTokens, setEditMaxTokens, editSpawnSubtasks, setEditSpawnSubtasks, editTalkGlobally, setEditTalkGlobally, editContinuous, setEditContinuous, editParentAgentId, setEditParentAgentId, editAllowedTools, setEditAllowedTools, agents, setAgents, selectedAgentId, setSelectedAgentId, activeOrgNode, setActiveOrgNode, messages, setMessages, tasks, setTasks, selectedKanbanTask, setSelectedKanbanTask, outcomeGoal, setOutcomeGoal, selectedMissionPack, setSelectedMissionPack, missionPreview, setMissionPreview, missionPacks, setMissionPacks, customPackName, setCustomPackName, autopilotEnabled, setAutopilotEnabled, autopilotScope, setAutopilotScope, approvalRequirements, setApprovalRequirements, networkPermissions, setNetworkPermissions, doneApprovalRules, setDoneApprovalRules, missionAuditEvents, setMissionAuditEvents, activeMissions, setActiveMissions, activeContract, setActiveContract, activeReceipt, setActiveReceipt, modelsCatalog, setModelsCatalog, selectedModelForInspect, setSelectedModelForInspect, modelDetails, setModelDetails, remoteModels, setRemoteModels, modelsSearchQuery, setModelsSearchQuery, modelsFilterQuant, setModelsFilterQuant, modelsSubTab, setModelsSubTab, importPath, setImportPath, importCopy, setImportCopy, preflightReport, setPreflightReport, preflightLoading, setPreflightLoading, smokeTestResult, setSmokeTestResult, smokeTesting, setSmokeTesting, storageUsage, setStorageUsage, activeModelDetailTab, setActiveModelDetailTab, developerMode, setDeveloperMode, metadataSearch, setMetadataSearch, tensorSearch, setTensorSearch, backendStatus, setBackendStatus, backendLogs, setBackendLogs, formAutoStart, setFormAutoStart, formAutoRestart, setFormAutoRestart, formStopOnExit, setFormStopOnExit, formPort, setFormPort, formLogPath, setFormLogPath, formBinaryPath, setFormBinaryPath, formBindAddress, setFormBindAddress, formMaxRestarts, setFormMaxRestarts, formBackoffPolicy, setFormBackoffPolicy, loadMissionData, handleGenerateProposal, handleApplyMission, handleDiscardMission, handleSaveCustomPack, handleUpdateAutopilotSettings, detailCommentText, setDetailCommentText, blockerText, setBlockerText, blockedByTaskId, setBlockedByTaskId, evidenceText, setEvidenceText, validationPassed, setValidationPassed, validationNotes, setValidationNotes, completionError, setCompletionError, selectedCompletingAgentId, setSelectedCompletingAgentId, selectedClaimingAgentId, setSelectedClaimingAgentId, isCompletingTask, setIsCompletingTask, isAddingBlocker, setIsAddingBlocker, taskRequiredFiles, setTaskRequiredFiles, taskAcceptanceCriteria, setTaskAcceptanceCriteria, taskDependencies, setTaskDependencies, modalDetailsTab, setModalDetailsTab, timelineEntries, setTimelineEntries, blackboardText, setBlackboardText, inputText, setInputText, inspectorTab, setInspectorTab, coordinationDetails, setCoordinationDetails, newDecisionText, setNewDecisionText, artifacts, setArtifacts, selectedArtifactPath, setSelectedArtifactPath, selectedArtifactContent, setSelectedArtifactContent, modelPriority, setModelPriority, cpuUsage, setCpuUsage, ramUsage, setRamUsage, tps, setTps, selectAgentForEdit, isSpawnModalOpen, setIsSpawnModalOpen, isTaskModalOpen, setIsTaskModalOpen, spawnName, setSpawnName, spawnRole, setSpawnRole, spawnPersona, setSpawnPersona, spawnProvider, setSpawnProvider, spawnModel, setSpawnModel, spawnTemp, setSpawnTemp, spawnMaxTokens, setSpawnMaxTokens, spawnContinuous, setSpawnContinuous, spawnParentAgentId, setSpawnParentAgentId, spawnAllowedTools, setSpawnAllowedTools, taskTitle, setTaskTitle, taskDesc, setTaskDesc, taskOwner, setTaskOwner, taskPriority, setTaskPriority, ollamaUrl, setOllamaUrl, camelidUrl, setCamelidUrl, openaiKey, setOpenaiKey, anthropicKey, setAnthropicKey, blackboardInput, setBlackboardInput, isThinking, setIsThinking, feedEndRef, loadSuggestions, loadTemplates, handleCreateSoftwareTeam, handleCreateCodingSprint, handleLaunchAgent, handleDecompose, handleApproveSubtasks, handleResolveCommandApproval, handleSuggestionAction, loadArtifacts, handleSelectArtifact, loadLocalModels, loadModelCatalog, loadStorageUsage, handleRemoteSearch, handlePreflightCheck, handleDownloadModel, handlePauseDownload, handleCancelDownload, handleImportLocal, handleOpenModelInspect, handleActivateModelScopedSelect, handleRunSmokeLoadingTest, handleDeleteModelSecure, loadBackendStatus, handleCheckBackendHealth, handleRestartBackend, handleStopBackend, handleGetBackendLogs, handleOpenBackendLogs, handleSaveBackendConfig, handleResetBackendRuntime, loadAgents, loadMessages, loadTasks, loadBlackboard, loadCoordinationDetails, handleResolveHandoff, loadProviderConfigs, handleSendMessage, handleSpawnAgent, handleSaveAgentConfig, handleRetireAgent, safeParseJson, recommendAgentForTask, handleCreateTask, handleTransitionStatus, handleClaimCard, handleCompleteCard, handleAddComment, handleAddBlocker, handleToggleChecklistItem, handleDeleteAgent, handleSaveSettings, blockingOverlayStyle, glassCardStyle, overlayTitleStyle, renderBlockingOverlay } = props;

  return (
    <>
(/* Crew Control Page */
<div className="agents-container" style={{
  flex: 1,
  display: "flex",
  height: "100%",
  overflow: "hidden"
}}>
            {/* Left Column: Agent Cards Grid */}
            <div className="agents-sidebar" style={{
    width: "320px",
    borderRight: "1px solid var(--border-color)",
    background: "rgba(0,0,0,0.15)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden"
  }}>
              <div style={{
      padding: "16px",
      fontSize: "0.78rem",
      fontWeight: 700,
      textTransform: "uppercase",
      color: "var(--text-muted)",
      borderBottom: "1px solid var(--border-color)",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    }}>
                <span>Active Agent Crew</span>
                <span className="kanban-column-count">{agents.length}</span>
              </div>
              
              <div className="agents-list" style={{
      flex: 1,
      padding: "12px",
      overflowY: "auto",
      display: "flex",
      flexDirection: "column",
      gap: "8px"
    }}>
                {agents.map(agent => {
        const isSelected = editAgentId === agent.id;
        let providerLabel = "camelid";
        if (agent.model_provider === "ollama") providerLabel = "ollama";
        if (agent.model_provider === "openai") providerLabel = "openai";
        if (agent.model_provider === "anthropic") providerLabel = "anthropic";
        return <div key={agent.id} onClick={() => selectAgentForEdit(agent)} style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "12px",
          borderRadius: "12px",
          cursor: "pointer",
          transition: "all 0.2s ease",
          background: isSelected ? "rgba(0,242,254,0.06)" : "rgba(255,255,255,0.01)",
          border: isSelected ? "1px solid rgba(0,242,254,0.25)" : "1px solid var(--border-color)"
        }}>
                      <div className="agent-avatar" style={{
            width: "40px",
            height: "40px",
            fontSize: "1.1rem",
            position: "relative"
          }}>
                        {agent.name.charAt(0)}
                        <div className={`status-badge ${agent.status}`} style={{
              width: "10px",
              height: "10px",
              bottom: "-2px",
              right: "-2px"
            }} />
                      </div>
                      
                      <div style={{
            flex: 1,
            minWidth: 0
          }}>
                        <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline"
            }}>
                          <span style={{
                fontSize: "0.85rem",
                fontWeight: 700,
                color: "var(--text-main)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap"
              }}>{agent.name}</span>
                          <span style={{
                fontSize: "0.65rem",
                textTransform: "uppercase",
                padding: "1px 6px",
                borderRadius: "6px",
                background: "rgba(0, 242, 254, 0.08)",
                color: "var(--accent-primary)",
                fontWeight: 700
              }}>{providerLabel}</span>
                        </div>
                        <div style={{
              fontSize: "0.75rem",
              color: "var(--text-muted)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              marginTop: "2px"
            }}>{agent.role}</div>
                        <div style={{
              fontSize: "0.68rem",
              color: "var(--text-muted)",
              fontFamily: "var(--font-mono)",
              marginTop: "4px"
            }}>🤖 {agent.model_name}</div>
                      </div>
                    </div>;
      })}
              </div>

              <div style={{
      padding: "16px",
      borderTop: "1px solid var(--border-color)"
    }}>
                <button className="sidebar-btn" style={{
        margin: 0,
        width: "100%"
      }} onClick={() => setIsSpawnModalOpen(true)}>
                  ➕ Spawn Custom Agent
                </button>
              </div>
            </div>

            {/* Right Column: Customization Editor */}
            <div className="agent-editor-pane" style={{
    flex: 1,
    display: "flex",
    flexDirection: "column",
    background: "rgba(0,0,0,0.2)",
    overflowY: "auto",
    padding: "24px"
  }}>
              {!editAgentId ? <div style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      color: "var(--text-muted)",
      gap: "12px",
      textAlign: "center",
      padding: "40px"
    }}>
                  <span style={{
        fontSize: "3rem"
      }}>🧠</span>
                  <h3 style={{
        fontSize: "1.1rem",
        fontWeight: 600,
        color: "var(--text-main)"
      }}>No Agent Selected</h3>
                  <p style={{
        fontSize: "0.85rem",
        maxWidth: "340px",
        lineHeight: 1.4
      }}>Select an active agent from the left crew list to customize their behavior prompts, tune LLM inference parameters, or reassign execution models.</p>
                </div> : <form onSubmit={handleSaveAgentConfig} style={{
      display: "flex",
      flexDirection: "column",
      gap: "20px",
      maxWidth: "800px"
    }}>
                  <div style={{
        display: "flex",
        alignItems: "center",
        gap: "16px",
        borderBottom: "1px solid var(--border-color)",
        paddingBottom: "20px"
      }}>
                    <div className="agent-avatar" style={{
          width: "56px",
          height: "56px",
          fontSize: "1.5rem"
        }}>
                      {editName.charAt(0) || "?"}
                    </div>
                    <div style={{
          flex: 1
        }}>
                      <h3 style={{
            fontSize: "1.2rem",
            fontWeight: 700,
            color: "var(--accent-primary)"
          }}>{editName || "Agent Profile"}</h3>
                      <p style={{
            fontSize: "0.8rem",
            color: "var(--text-muted)"
          }}>Agent ID: <span style={{
              fontFamily: "var(--font-mono)"
            }}>{editAgentId}</span> | Status: <span style={{
              textTransform: "capitalize",
              fontWeight: 600,
              color: agents.find(a => a.id === editAgentId)?.status === "working" ? "var(--color-working)" : "var(--text-main)"
            }}>{agents.find(a => a.id === editAgentId)?.status}</span></p>
                    </div>
                  </div>

                  {/* Editable Profile Inputs */}
                  <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        gap: "16px"
      }}>
                    <div className="form-group">
                      <label className="form-label">Agent Display Name</label>
                      <input className="form-input" required value={editName} onChange={e => setEditName(e.target.value)} placeholder="e.g. Sentry Analyst" />
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label">Primary Assigned Role</label>
                      <input className="form-input" required value={editRole} onChange={e => setEditRole(e.target.value)} placeholder="e.g. Quality Assurance Sentry" />
                    </div>
                  </div>

                  {/* Model Assignment Section */}
                  <div style={{
        background: "rgba(255,255,255,0.01)",
        border: "1px solid var(--border-color)",
        borderRadius: "14px",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "16px"
      }}>
                    <h4 style={{
          fontSize: "0.88rem",
          fontWeight: 700,
          color: "var(--accent-primary)",
          display: "flex",
          alignItems: "center",
          gap: "6px"
        }}>🧠 Inference Provider & Model Assignment</h4>
                    
                    <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px"
        }}>
                      <div className="form-group">
                        <label className="form-label">Active Provider</label>
                        <select className="form-input" value={editProvider} onChange={e => {
              setEditProvider(e.target.value);
              if (e.target.value === "camelid") setEditModelName("camelid-default");else if (e.target.value === "ollama") setEditModelName("qwen2.5-coder");else if (e.target.value === "openai") setEditModelName("gpt-4o");else if (e.target.value === "anthropic") setEditModelName("claude-3-5-sonnet");
            }} style={{
              background: "#0a0d14",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#fff",
              height: "42px"
            }}>
                          <option value="camelid">Local Camelid GGUF</option>
                          <option value="ollama">Ollama Local API</option>
                          <option value="openai">OpenAI Cloud API</option>
                          <option value="anthropic">Anthropic Claude API</option>
                        </select>
                      </div>
                      
                      <div className="form-group">
                        <label className="form-label">LLM Model Name</label>
                        {(() => {
              const camelidOptions = ["camelid-default", "tinyllama-1.1b-chat-v1.0.Q8_0.gguf", "Llama-3.2-1B-Instruct-Q8_0.gguf", "Llama-3.2-3B-Instruct-Q8_0.gguf", "Meta-Llama-3-8B-Instruct-Q8_0.gguf", "Mistral-7B-Instruct-v0.3.Q8_0.gguf", ...localModels];
              const uniqueCamelid = Array.from(new Set(camelidOptions));
              const ollamaOptions = ["qwen2.5-coder", "llama3.2", "llama3", "mistral", "deepseek-r1"];
              const openaiOptions = ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "o1-mini", "o1-preview"];
              const anthropicOptions = ["claude-3-5-sonnet", "claude-3-5-haiku", "claude-3-opus"];
              let opts: string[] = [];
              let defaultVal = "";
              if (editProvider === "camelid") {
                opts = uniqueCamelid;
                defaultVal = "camelid-default";
              } else if (editProvider === "ollama") {
                opts = ollamaOptions;
                defaultVal = "qwen2.5-coder";
              } else if (editProvider === "openai") {
                opts = openaiOptions;
                defaultVal = "gpt-4o";
              } else if (editProvider === "anthropic") {
                opts = anthropicOptions;
                defaultVal = "claude-3-5-sonnet";
              }
              const isCustom = editModelName !== "" && !opts.includes(editModelName);
              const selectValue = isCustom ? "__custom__" : editModelName || defaultVal;
              return <div style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px"
              }}>
                              <select className="form-input" value={selectValue} onChange={e => {
                  if (e.target.value === "__custom__") {
                    setEditModelName("");
                  } else {
                    setEditModelName(e.target.value);
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
                                {editProvider !== "camelid" && <option value="__custom__">✦ Custom Model Tag...</option>}
                              </select>
                              {(isCustom || selectValue === "__custom__") && <input className="form-input" required value={editModelName} onChange={e => setEditModelName(e.target.value)} placeholder="Type custom tag, e.g. llama3.2:1b" style={{
                  marginTop: "4px"
                }} />}
                            </div>;
            })()}
                      </div>
                    </div>
                  </div>

                  {/* Multi-Model Telemetry & Concurrency Notice */}
                  <div style={{
        background: "rgba(0, 242, 254, 0.03)",
        border: "1px solid rgba(0, 242, 254, 0.15)",
        borderRadius: "14px",
        padding: "16px 20px",
        display: "flex",
        alignItems: "flex-start",
        gap: "12px"
      }}>
                    <span style={{
          fontSize: "1.3rem",
          marginTop: "2px"
        }}>⚡</span>
                    <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "4px"
        }}>
                      <span style={{
            fontSize: "0.85rem",
            fontWeight: 700,
            color: "var(--accent-primary)"
          }}>Concurrent Multi-Model Routing Active</span>
                      <p style={{
            fontSize: "0.76rem",
            color: "var(--text-muted)",
            lineHeight: 1.4,
            margin: 0
          }}>
                        Each agent in your crew is fully containerized. By assigning distinct local weights (via Ollama) or cloud engines (via OpenAI/Anthropic), your agents can operate and execute task block dependencies <span style={{
              color: "var(--text-main)",
              fontWeight: 600
            }}>simultaneously and concurrently</span>. Use the left crew list to assign specialists to their ideal reasoning model!
                      </p>
                    </div>
                  </div>

                  {/* System Prompt / Persona Directive */}
                  <div className="form-group">
                    <label className="form-label" style={{
          display: "flex",
          justifyContent: "space-between"
        }}>
                      <span>📜 Soul Persona & Instructions (SOUL.md)</span>
                      <span style={{
            fontSize: "0.7rem",
            color: "var(--text-muted)"
          }}>Supports custom ReAct behavior prompts</span>
                    </label>
                    <textarea className="form-input form-textarea" required value={editPersona} onChange={e => setEditPersona(e.target.value)} placeholder="Specify agent behaviors, capabilities, and system rules..." style={{
          height: "180px",
          fontFamily: "var(--font-mono)",
          fontSize: "0.8rem",
          lineHeight: 1.4
        }} />
                  </div>

                  {/* Advanced Parameter Sliders */}
                  <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: "16px",
        background: "rgba(255,255,255,0.01)",
        border: "1px solid var(--border-color)",
        borderRadius: "14px",
        padding: "20px"
      }}>
                    <div className="form-group">
                      <label className="form-label">Temperature: {editTemp}</label>
                      <input type="range" min="0.1" max="1.5" step="0.1" value={editTemp} onChange={e => setEditTemp(parseFloat(e.target.value))} style={{
            width: "100%",
            accentColor: "var(--accent-primary)",
            margin: "10px 0"
          }} />
                      <span style={{
            fontSize: "0.68rem",
            color: "var(--text-muted)"
          }}>Lower values are more factual, higher values are creative.</span>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Max Token Output Limit</label>
                      <input type="number" className="form-input" value={editMaxTokens} onChange={e => setEditMaxTokens(parseInt(e.target.value))} min={64} max={16384} />
                    </div>
                  </div>

                  {/* Behavior Flags */}
                  <div style={{
        background: "rgba(255,255,255,0.01)",
        border: "1px solid var(--border-color)",
        borderRadius: "14px",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "12px"
      }}>
                    <h4 style={{
          fontSize: "0.88rem",
          fontWeight: 700,
          color: "var(--accent-primary)"
        }}>🛡️ Safety & Execution Policies</h4>
                    
                    <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          marginTop: "4px"
        }}>
                      <label style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            cursor: "pointer",
            userSelect: "none",
            fontSize: "0.85rem"
          }}>
                        <input type="checkbox" checked={editContinuous} onChange={e => setEditContinuous(e.target.checked)} style={{
              width: "16px",
              height: "16px",
              cursor: "pointer"
            }} />
                        <div>
                          <div style={{
                fontWeight: 600,
                color: "var(--text-main)"
              }}>Continuous Autonomous Loop Execution</div>
                          <div style={{
                fontSize: "0.72rem",
                color: "var(--text-muted)"
              }}>Agent will automatically plan, run whitelisted shell actions, and self-heal without stopping.</div>
                        </div>
                      </label>

                      <label style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            cursor: "pointer",
            userSelect: "none",
            fontSize: "0.85rem",
            borderTop: "1px solid rgba(255,255,255,0.04)",
            paddingTop: "10px"
          }}>
                        <input type="checkbox" checked={editSpawnSubtasks} onChange={e => setEditSpawnSubtasks(e.target.checked)} style={{
              width: "16px",
              height: "16px",
              cursor: "pointer"
            }} />
                        <div>
                          <div style={{
                fontWeight: 600,
                color: "var(--text-main)"
              }}>Spawn Subtask Authority</div>
                          <div style={{
                fontSize: "0.72rem",
                color: "var(--text-muted)"
              }}>Permits the agent to create dependency objectives and delegate subtasks to other crew.</div>
                        </div>
                      </label>

                      <label style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            cursor: "pointer",
            userSelect: "none",
            fontSize: "0.85rem",
            borderTop: "1px solid rgba(255,255,255,0.04)",
            paddingTop: "10px"
          }}>
                        <input type="checkbox" checked={editTalkGlobally} onChange={e => setEditTalkGlobally(e.target.checked)} style={{
              width: "16px",
              height: "16px",
              cursor: "pointer"
            }} />
                        <div>
                          <div style={{
                fontWeight: 600,
                color: "var(--text-main)"
              }}>Global Blackboard Broadcasting</div>
                          <div style={{
                fontSize: "0.72rem",
                color: "var(--text-muted)"
              }}>Allows this agent to broadcast state details directly to the shared coordination feed.</div>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="form-group" style={{
        gridColumn: "span 2",
        marginTop: "12px",
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
                          <input type="checkbox" checked={editAllowedTools.includes(tool)} onChange={e => {
              if (e.target.checked) setEditAllowedTools([...editAllowedTools, tool]);else setEditAllowedTools(editAllowedTools.filter(t => t !== tool));
            }} /> {tool}
                        </label>)}
                    </div>
                  </div>

                  <div className="form-group" style={{
        gridColumn: "span 2",
        marginTop: "12px",
        paddingTop: "12px",
        borderTop: "1px dashed var(--border-color)"
      }}>
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
                    <select className="form-input" value={editParentAgentId} onChange={e => setEditParentAgentId(e.target.value)}>
                      <option value="">-- No Parent (Root Level) --</option>
                      {agents.filter(a => a.id !== editAgentId).map(a => <option key={a.id} value={a.id}>{a.name} ({a.role})</option>)}
                    </select>
                  </div>

                  {/* Submit Actions */}
                  <div style={{
        display: "flex",
        gap: "16px",
        marginTop: "8px",
        borderTop: "1px solid var(--border-color)",
        paddingTop: "20px",
        justifyContent: "flex-end"
      }}>
                    <button type="button" className="action-btn danger-btn" style={{
          margin: 0,
          padding: "10px 24px"
        }} onClick={() => handleRetireAgent(editAgentId)}>
                      🚫 Retire Agent from Crew
                    </button>
                    
                    <button type="submit" className="sidebar-btn" style={{
          margin: 0,
          padding: "10px 24px"
        }}>
                      💾 Save System Directive
                    </button>
                  </div>
                </form>}
            </div>
          </div>)
    </>
  );
}