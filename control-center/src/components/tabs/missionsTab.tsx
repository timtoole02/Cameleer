import { useAppStore } from '../../hooks/useAppStore';

export function missionsTab(props: ReturnType<typeof useAppStore>) {
  const { activeTab, setActiveTab, kanbanView, setKanbanView, refreshKanban, setRefreshKanban, suggestions, setSuggestions, templates, setTemplates, selectedTemplateKey, setSelectedTemplateKey, wizardCustomName, setWizardCustomName, decomposingTaskId, setDecomposingTaskId, decomposedProposals, setDecomposedProposals, localModels, setLocalModels, activeModel, setActiveModel, downloadState, setDownloadState, editAgentId, setEditAgentId, editName, setEditName, editRole, setEditRole, editPersona, setEditPersona, editProvider, setEditProvider, editModelName, setEditModelName, editTemp, setEditTemp, editMaxTokens, setEditMaxTokens, editSpawnSubtasks, setEditSpawnSubtasks, editTalkGlobally, setEditTalkGlobally, editContinuous, setEditContinuous, editParentAgentId, setEditParentAgentId, editAllowedTools, setEditAllowedTools, agents, setAgents, selectedAgentId, setSelectedAgentId, activeOrgNode, setActiveOrgNode, messages, setMessages, tasks, setTasks, selectedKanbanTask, setSelectedKanbanTask, outcomeGoal, setOutcomeGoal, selectedMissionPack, setSelectedMissionPack, missionPreview, setMissionPreview, missionPacks, setMissionPacks, customPackName, setCustomPackName, autopilotEnabled, setAutopilotEnabled, autopilotScope, setAutopilotScope, approvalRequirements, setApprovalRequirements, networkPermissions, setNetworkPermissions, doneApprovalRules, setDoneApprovalRules, missionAuditEvents, setMissionAuditEvents, activeMissions, setActiveMissions, activeContract, setActiveContract, activeReceipt, setActiveReceipt, modelsCatalog, setModelsCatalog, selectedModelForInspect, setSelectedModelForInspect, modelDetails, setModelDetails, remoteModels, setRemoteModels, modelsSearchQuery, setModelsSearchQuery, modelsFilterQuant, setModelsFilterQuant, modelsSubTab, setModelsSubTab, importPath, setImportPath, importCopy, setImportCopy, preflightReport, setPreflightReport, preflightLoading, setPreflightLoading, smokeTestResult, setSmokeTestResult, smokeTesting, setSmokeTesting, storageUsage, setStorageUsage, activeModelDetailTab, setActiveModelDetailTab, developerMode, setDeveloperMode, metadataSearch, setMetadataSearch, tensorSearch, setTensorSearch, backendStatus, setBackendStatus, backendLogs, setBackendLogs, formAutoStart, setFormAutoStart, formAutoRestart, setFormAutoRestart, formStopOnExit, setFormStopOnExit, formPort, setFormPort, formLogPath, setFormLogPath, formBinaryPath, setFormBinaryPath, formBindAddress, setFormBindAddress, formMaxRestarts, setFormMaxRestarts, formBackoffPolicy, setFormBackoffPolicy, loadMissionData, handleGenerateProposal, handleApplyMission, handleDiscardMission, handleSaveCustomPack, handleUpdateAutopilotSettings, detailCommentText, setDetailCommentText, blockerText, setBlockerText, blockedByTaskId, setBlockedByTaskId, evidenceText, setEvidenceText, validationPassed, setValidationPassed, validationNotes, setValidationNotes, completionError, setCompletionError, selectedCompletingAgentId, setSelectedCompletingAgentId, selectedClaimingAgentId, setSelectedClaimingAgentId, isCompletingTask, setIsCompletingTask, isAddingBlocker, setIsAddingBlocker, taskRequiredFiles, setTaskRequiredFiles, taskAcceptanceCriteria, setTaskAcceptanceCriteria, taskDependencies, setTaskDependencies, modalDetailsTab, setModalDetailsTab, timelineEntries, setTimelineEntries, blackboardText, setBlackboardText, inputText, setInputText, inspectorTab, setInspectorTab, coordinationDetails, setCoordinationDetails, newDecisionText, setNewDecisionText, artifacts, setArtifacts, selectedArtifactPath, setSelectedArtifactPath, selectedArtifactContent, setSelectedArtifactContent, modelPriority, setModelPriority, cpuUsage, setCpuUsage, ramUsage, setRamUsage, tps, setTps, selectAgentForEdit, isSpawnModalOpen, setIsSpawnModalOpen, isTaskModalOpen, setIsTaskModalOpen, spawnName, setSpawnName, spawnRole, setSpawnRole, spawnPersona, setSpawnPersona, spawnProvider, setSpawnProvider, spawnModel, setSpawnModel, spawnTemp, setSpawnTemp, spawnMaxTokens, setSpawnMaxTokens, spawnContinuous, setSpawnContinuous, spawnParentAgentId, setSpawnParentAgentId, spawnAllowedTools, setSpawnAllowedTools, taskTitle, setTaskTitle, taskDesc, setTaskDesc, taskOwner, setTaskOwner, taskPriority, setTaskPriority, ollamaUrl, setOllamaUrl, camelidUrl, setCamelidUrl, openaiKey, setOpenaiKey, anthropicKey, setAnthropicKey, blackboardInput, setBlackboardInput, isThinking, setIsThinking, feedEndRef, loadSuggestions, loadTemplates, handleCreateSoftwareTeam, handleCreateCodingSprint, handleLaunchAgent, handleDecompose, handleApproveSubtasks, handleResolveCommandApproval, handleSuggestionAction, loadArtifacts, handleSelectArtifact, loadLocalModels, loadModelCatalog, loadStorageUsage, handleRemoteSearch, handlePreflightCheck, handleDownloadModel, handlePauseDownload, handleCancelDownload, handleImportLocal, handleOpenModelInspect, handleActivateModelScopedSelect, handleRunSmokeLoadingTest, handleDeleteModelSecure, loadBackendStatus, handleCheckBackendHealth, handleRestartBackend, handleStopBackend, handleGetBackendLogs, handleOpenBackendLogs, handleSaveBackendConfig, handleResetBackendRuntime, loadAgents, loadMessages, loadTasks, loadBlackboard, loadCoordinationDetails, handleResolveHandoff, loadProviderConfigs, handleSendMessage, handleSpawnAgent, handleSaveAgentConfig, handleRetireAgent, safeParseJson, recommendAgentForTask, handleCreateTask, handleTransitionStatus, handleClaimCard, handleCompleteCard, handleAddComment, handleAddBlocker, handleToggleChecklistItem, handleDeleteAgent, handleSaveSettings, blockingOverlayStyle, glassCardStyle, overlayTitleStyle, renderBlockingOverlay } = props;

  return (
    <>
(/* Crew Autonomy & Mission Builder Portal */
<div className="missions-container" style={{
  flex: 1,
  display: "flex",
  height: "100%",
  overflow: "hidden"
}}>
            
            {/* Left Column: Outcome Planner & Autopilot Settings */}
            <div className="missions-planner-sidebar" style={{
    width: "420px",
    borderRight: "1px solid var(--border-color)",
    background: "rgba(0,0,0,0.18)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden"
  }}>
              <div style={{
      padding: "16px 20px",
      borderBottom: "1px solid var(--border-color)",
      background: "rgba(0,0,0,0.08)"
    }}>
                <h3 style={{
        margin: 0,
        fontSize: "0.85rem",
        fontWeight: 700,
        textTransform: "uppercase",
        color: "var(--accent-primary)",
        letterSpacing: "0.5px"
      }}>
                  🎯 Workspace Outcome Planner
                </h3>
              </div>
              
              <div style={{
      flex: 1,
      overflowY: "auto",
      padding: "20px",
      display: "flex",
      flexDirection: "column",
      gap: "24px"
    }}>
                
                {/* Section 1: Outcome Goal */}
                <div className="card-glass" style={{
        padding: "16px",
        borderRadius: "12px",
        border: "1px solid var(--border-color)",
        background: "rgba(255,255,255,0.01)"
      }}>
                  <label style={{
          display: "block",
          fontSize: "0.8rem",
          fontWeight: 600,
          color: "var(--text-main)",
          marginBottom: "8px"
        }}>
                    Select Accelerating Mission Pack
                  </label>
                  <select value={selectedMissionPack} onChange={e => setSelectedMissionPack(e.target.value)} style={{
          width: "100%",
          padding: "10px",
          borderRadius: "8px",
          background: "rgba(0,0,0,0.4)",
          border: "1px solid var(--border-color)",
          color: "var(--text-main)",
          fontSize: "0.82rem",
          marginBottom: "12px"
        }}>
                    {missionPacks.map(pack => <option key={pack.mission_pack_id} value={pack.mission_pack_id}>
                        {pack.name} ({pack.category})
                      </option>)}
                  </select>

                  <label style={{
          display: "block",
          fontSize: "0.8rem",
          fontWeight: 600,
          color: "var(--text-main)",
          marginBottom: "8px"
        }}>
                    Describe Desired Outcome / Goal
                  </label>
                  <textarea value={outcomeGoal} onChange={e => setOutcomeGoal(e.target.value)} placeholder="E.g., Build a Tetris game in HTML/TS with keyboard controls, collision checks, score metrics, and manual..." style={{
          width: "100%",
          height: "90px",
          padding: "10px",
          borderRadius: "8px",
          background: "rgba(0,0,0,0.4)",
          border: "1px solid var(--border-color)",
          color: "var(--text-main)",
          fontSize: "0.82rem",
          lineHeight: 1.4,
          resize: "none",
          marginBottom: "16px",
          fontFamily: "inherit"
        }} />

                  <button onClick={handleGenerateProposal} className="btn-primary" style={{
          width: "100%",
          padding: "10px 14px",
          borderRadius: "8px",
          background: "linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)",
          border: "none",
          color: "#06080c",
          fontSize: "0.82rem",
          fontWeight: 700,
          cursor: "pointer",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "8px",
          boxShadow: "0 0 15px rgba(0,242,254,0.15)"
        }}>
                    ✦ Propose Crew & Workboard
                  </button>
                </div>

                {/* Section 2: Autopilot Scope & Dashboard widgets */}
                <div className="card-glass" style={{
        padding: "16px",
        borderRadius: "12px",
        border: "1px solid var(--border-color)",
        background: "rgba(255,255,255,0.01)"
      }}>
                  <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "14px"
        }}>
                    <h4 style={{
            margin: 0,
            fontSize: "0.8rem",
            fontWeight: 700,
            color: "var(--text-main)",
            textTransform: "uppercase"
          }}>
                      🚀 Autopilot Controls
                    </h4>
                    <span style={{
            fontSize: "0.68rem",
            color: autopilotEnabled ? "#10b981" : "var(--text-muted)",
            background: autopilotEnabled ? "rgba(16,185,129,0.08)" : "rgba(255,255,255,0.04)",
            padding: "2px 8px",
            borderRadius: "6px",
            fontWeight: "bold"
          }}>
                      {autopilotEnabled ? "Active" : "Off"}
                    </span>
                  </div>

                  <label style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          fontSize: "0.82rem",
          cursor: "pointer",
          marginBottom: "14px"
        }}>
                    <input type="checkbox" checked={autopilotEnabled} onChange={e => handleUpdateAutopilotSettings(e.target.checked, autopilotScope, approvalRequirements, networkPermissions, doneApprovalRules)} style={{
            width: "16px",
            height: "16px",
            accentColor: "var(--accent-primary)"
          }} />
                    <span>Enable Workspace Autopilot Autonomy</span>
                  </label>

                  <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px"
        }}>
                    <div>
                      <label style={{
              display: "block",
              fontSize: "0.75rem",
              color: "var(--text-muted)",
              marginBottom: "4px"
            }}>Autopilot Scope</label>
                      <select value={autopilotScope} onChange={e => handleUpdateAutopilotSettings(autopilotEnabled, e.target.value, approvalRequirements, networkPermissions, doneApprovalRules)} style={{
              width: "100%",
              padding: "8px",
              borderRadius: "6px",
              background: "rgba(0,0,0,0.4)",
              border: "1px solid var(--border-color)",
              color: "var(--text-main)",
              fontSize: "0.78rem"
            }}>
                        <option value="off">Off (Manual starts only)</option>
                        <option value="card">Card Autopilot (Current card only)</option>
                        <option value="agent">Agent Autopilot (Assigned cards queue)</option>
                        <option value="mission">Mission Autopilot (Full board coordination)</option>
                      </select>
                    </div>

                    <div>
                      <label style={{
              display: "block",
              fontSize: "0.75rem",
              color: "var(--text-muted)",
              marginBottom: "4px"
            }}>Approval Safety Profile</label>
                      <select value={approvalRequirements} onChange={e => handleUpdateAutopilotSettings(autopilotEnabled, autopilotScope, e.target.value, networkPermissions, doneApprovalRules)} style={{
              width: "100%",
              padding: "8px",
              borderRadius: "6px",
              background: "rgba(0,0,0,0.4)",
              border: "1px solid var(--border-color)",
              color: "var(--text-main)",
              fontSize: "0.78rem"
            }}>
                        <option value="strict">Strict (Review all file changes & runs)</option>
                        <option value="moderate">Moderate (Freely read, ask on writes)</option>
                        <option value="none">None (Headless run sandbox)</option>
                      </select>
                    </div>

                    <div>
                      <label style={{
              display: "block",
              fontSize: "0.75rem",
              color: "var(--text-muted)",
              marginBottom: "4px"
            }}>Network Boundaries</label>
                      <select value={networkPermissions} onChange={e => handleUpdateAutopilotSettings(autopilotEnabled, autopilotScope, approvalRequirements, e.target.value, doneApprovalRules)} style={{
              width: "100%",
              padding: "8px",
              borderRadius: "6px",
              background: "rgba(0,0,0,0.4)",
              border: "1px solid var(--border-color)",
              color: "var(--text-main)",
              fontSize: "0.78rem"
            }}>
                        <option value="none">No External Calls (Sandboxed)</option>
                        <option value="whitelist">Whitelisted addresses only</option>
                        <option value="all">Unconstrained network access</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Section 3: Audited Events Terminal Logs */}
                <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: "10px"
      }}>
                  <h4 style={{
          margin: 0,
          fontSize: "0.78rem",
          fontWeight: 700,
          textTransform: "uppercase",
          color: "var(--text-muted)"
        }}>
                    🛡️ Autopilot Security Audit Log
                  </h4>
                  <div style={{
          flex: 1,
          minHeight: "150px",
          padding: "12px",
          borderRadius: "10px",
          background: "rgba(0,0,0,0.5)",
          border: "1px solid var(--border-color)",
          overflowY: "auto",
          fontFamily: "var(--font-mono)",
          fontSize: "0.74rem",
          lineHeight: 1.4,
          color: "var(--text-muted)"
        }}>
                    {missionAuditEvents.length === 0 ? <div style={{
            color: "var(--text-muted)"
          }}>// No audit events logged yet. Active sandboxes will output records here.</div> : <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "6px"
          }}>
                        {missionAuditEvents.map(ev => <div key={ev.id} style={{
              borderBottom: "1px solid rgba(255,255,255,0.02)",
              paddingBottom: "4px"
            }}>
                            <span style={{
                color: "var(--accent-secondary)"
              }}>[{ev.timestamp.split(" ")[1] || ev.timestamp}]</span>{" "}
                            <span style={{
                color: "var(--accent-primary)",
                fontWeight: "bold"
              }}>{ev.event_type.toUpperCase()}</span>{" "}
                            <span style={{
                color: "var(--text-main)"
              }}>{ev.payload}</span>
                          </div>)}
                      </div>}
                  </div>
                </div>

                {/* Section 4: Live Missions Execution Tracker */}
                <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: "10px"
      }}>
                  <h4 style={{
          margin: 0,
          fontSize: "0.78rem",
          fontWeight: 700,
          textTransform: "uppercase",
          color: "var(--text-muted)"
        }}>
                    📡 Live Missions Execution Tracker
                  </h4>
                  <div style={{
          flex: 1,
          minHeight: "150px",
          padding: "12px",
          borderRadius: "10px",
          background: "rgba(0,0,0,0.5)",
          border: "1px solid var(--border-color)",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "12px"
        }}>
                    {activeMissions.length === 0 ? <div style={{
            color: "var(--text-muted)",
            fontSize: "0.74rem",
            fontFamily: "var(--font-mono)"
          }}>// No active missions in progress.</div> : activeMissions.map(m => <div key={m.preview_id} className="card-glass" style={{
            padding: "12px",
            borderRadius: "8px",
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.05)"
          }}>
                          <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "8px"
            }}>
                            <div style={{
                fontSize: "0.8rem",
                fontWeight: "bold",
                color: "var(--accent-primary)"
              }}>{m.title}</div>
                            <button onClick={() => {
                setKanbanView("board");
                setActiveTab("kanban");
              }} style={{
                background: "none",
                border: "1px solid var(--accent-secondary)",
                borderRadius: "4px",
                padding: "2px 6px",
                fontSize: "0.65rem",
                color: "var(--accent-secondary)",
                cursor: "pointer",
                textTransform: "uppercase"
              }}>
                              View Board
                            </button>
                          </div>
                          <div style={{
              fontSize: "0.7rem",
              color: "var(--text-muted)",
              marginBottom: "10px",
              lineHeight: 1.3
            }}>
                            {m.goal}
                          </div>
                          <div style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "0.7rem",
              color: "var(--text-main)",
              marginBottom: "4px"
            }}>
                            <span>{m.completed_cards} / {m.total_cards} Tasks</span>
                            <span>{m.progress_percent.toFixed(0)}%</span>
                          </div>
                          <div style={{
              width: "100%",
              height: "6px",
              background: "rgba(255,255,255,0.1)",
              borderRadius: "3px",
              overflow: "hidden"
            }}>
                            <div style={{
                width: `${m.progress_percent}%`,
                height: "100%",
                background: "linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))",
                transition: "width 0.3s ease"
              }}></div>
                          </div>
                        </div>)}
                  </div>
                </div>

              </div>
            </div>

            {/* Right Column: Mission Preview Inspector */}
            <div className="missions-proposal-body" style={{
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden"
  }}>
              <div style={{
      padding: "16px 28px",
      borderBottom: "1px solid var(--border-color)",
      background: "rgba(0,0,0,0.08)",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    }}>
                <div>
                  <h2 style={{
          margin: 0,
          fontSize: "1.0rem",
          fontWeight: 700,
          color: "var(--text-main)"
        }}>
                    {missionPreview ? missionPreview.mission_title : "No Active Proposal"}
                  </h2>
                  <p style={{
          margin: "2px 0 0 0",
          fontSize: "0.75rem",
          color: "var(--text-muted)"
        }}>
                    {missionPreview ? `Workspace goal proposal blueprint. Draft generated at ${new Date(parseInt(missionPreview.generated_at) * 1000).toLocaleTimeString()}` : "Formulate a mission goal on the left side to compile a crew and card hierarchy proposal."}
                  </p>
                </div>
                {missionPreview && <span style={{
        fontSize: "0.7rem",
        color: "var(--accent-primary)",
        border: "1px solid rgba(0,242,254,0.3)",
        background: "rgba(0,242,254,0.06)",
        padding: "2px 8px",
        borderRadius: "6px",
        fontWeight: "bold",
        textTransform: "uppercase"
      }}>
                    Preview: {missionPreview.status}
                  </span>}
              </div>

              {/* Preview Body */}
              <div style={{
      flex: 1,
      overflowY: "auto",
      padding: "28px",
      display: "flex",
      flexDirection: "column",
      gap: "28px"
    }}>
                {!missionPreview ? (/* Empty state */
      <div style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        height: "100%",
        gap: "16px",
        color: "var(--text-muted)"
      }}>
                    <div style={{
          fontSize: "3.5rem"
        }}>🤖</div>
                    <div style={{
          fontSize: "0.95rem",
          fontWeight: 500,
          color: "var(--text-main)"
        }}>Cameleer Intelligent Workspace Architect</div>
                    <div style={{
          fontSize: "0.82rem",
          maxWidth: "420px",
          textAlign: "center",
          lineHeight: 1.4
        }}>
                      Enter your desired project goal (e.g., game developers, repository bug fixes, document sweeps) on the outcome planner. Nothing is created on your workspace until you approve the compiled blueprint!
                    </div>
                  </div>) : (/* Preview active state */
      <>
                    {/* Risks and Assumptions banner */}
                    <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "16px"
        }}>
                      <div style={{
            background: "rgba(245,158,11,0.03)",
            border: "1px solid rgba(245,158,11,0.15)",
            borderRadius: "10px",
            padding: "12px 16px"
          }}>
                        <h4 style={{
              margin: "0 0 6px 0",
              fontSize: "0.76rem",
              fontWeight: 700,
              textTransform: "uppercase",
              color: "#f59e0b"
            }}>⚠️ Identified Constraints & Risks</h4>
                        <ul style={{
              margin: 0,
              paddingLeft: "16px",
              fontSize: "0.78rem",
              color: "var(--text-muted)",
              lineHeight: 1.4
            }}>
                          {missionPreview.risks.map((r: string, idx: number) => <li key={idx}>{r}</li>)}
                        </ul>
                      </div>
                      <div style={{
            background: "rgba(79,172,254,0.03)",
            border: "1px solid rgba(79,172,254,0.15)",
            borderRadius: "10px",
            padding: "12px 16px"
          }}>
                        <h4 style={{
              margin: "0 0 6px 0",
              fontSize: "0.76rem",
              fontWeight: 700,
              textTransform: "uppercase",
              color: "var(--accent-secondary)"
            }}>✦ Key Architecture Assumptions</h4>
                        <ul style={{
              margin: 0,
              paddingLeft: "16px",
              fontSize: "0.78rem",
              color: "var(--text-muted)",
              lineHeight: 1.4
            }}>
                          {missionPreview.assumptions.map((a: string, idx: number) => <li key={idx}>{a}</li>)}
                        </ul>
                      </div>
                    </div>

                    {/* Proposed Team */}
                    <div>
                      <h3 style={{
            fontSize: "0.9rem",
            fontWeight: 700,
            textTransform: "uppercase",
            color: "var(--accent-primary)",
            letterSpacing: "0.5px",
            marginBottom: "12px"
          }}>
                        👥 Proposed Specialized Agent Crew
                      </h3>
                      <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "16px"
          }}>
                        {missionPreview.proposed_agents.map((agent: any, idx: number) => <div key={idx} className="card-glass" style={{
              padding: "16px",
              borderRadius: "12px",
              border: "1px solid var(--border-color)",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              background: "rgba(255,255,255,0.01)"
            }}>
                            <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                              <input value={agent.name} onChange={e => {
                  const updated = [...missionPreview.proposed_agents];
                  updated[idx].name = e.target.value;
                  setMissionPreview({
                    ...missionPreview,
                    proposed_agents: updated
                  });
                }} style={{
                  fontSize: "0.85rem",
                  fontWeight: "bold",
                  background: "none",
                  border: "none",
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                  color: "var(--text-main)",
                  padding: "2px 4px",
                  width: "130px"
                }} />
                              <button onClick={() => {
                  const updated = missionPreview.proposed_agents.filter((_: any, i: number) => i !== idx);
                  setMissionPreview({
                    ...missionPreview,
                    proposed_agents: updated
                  });
                }} style={{
                  background: "none",
                  border: "none",
                  color: "var(--color-blocked)",
                  fontSize: "0.85rem",
                  cursor: "pointer"
                }}>
                                Remove
                              </button>
                            </div>

                            <div style={{
                fontSize: "0.75rem",
                color: "var(--text-muted)"
              }}>
                              <strong>Role:</strong> {agent.role}
                            </div>

                            <div>
                              <label style={{
                  display: "block",
                  fontSize: "0.7rem",
                  color: "var(--text-muted)",
                  marginBottom: "4px"
                }}>Inference Model</label>
                              <input value={agent.suggested_model} onChange={e => {
                  const updated = [...missionPreview.proposed_agents];
                  updated[idx].suggested_model = e.target.value;
                  setMissionPreview({
                    ...missionPreview,
                    proposed_agents: updated
                  });
                }} style={{
                  width: "100%",
                  padding: "6px",
                  borderRadius: "6px",
                  background: "rgba(0,0,0,0.3)",
                  border: "1px solid var(--border-color)",
                  color: "var(--text-main)",
                  fontSize: "0.75rem"
                }} />
                            </div>

                            <div>
                              <label style={{
                  display: "block",
                  fontSize: "0.7rem",
                  color: "var(--text-muted)",
                  marginBottom: "4px"
                }}>Allowed Tools Scope</label>
                              <div style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "4px"
                }}>
                                {agent.allowed_tools.map((t: string, tid: number) => <span key={tid} style={{
                    fontSize: "0.66rem",
                    background: "rgba(124, 77, 255, 0.08)",
                    color: "var(--accent-primary)",
                    padding: "2px 6px",
                    borderRadius: "4px"
                  }}>
                                    {t}
                                  </span>)}
                              </div>
                            </div>

                            <div style={{
                fontSize: "0.72rem",
                color: "var(--text-muted)",
                background: "rgba(255,255,255,0.01)",
                padding: "8px",
                borderRadius: "6px",
                border: "1px solid rgba(255,255,255,0.03)",
                lineClamp: 2,
                overflow: "hidden"
              }}>
                              <strong>Rationale:</strong> {agent.rationale || "Seeded template profile."}
                            </div>
                          </div>)}
                      </div>
                    </div>

                    {/* Proposed Cards */}
                    <div>
                      <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "12px"
          }}>
                        <h3 style={{
              margin: 0,
              fontSize: "0.9rem",
              fontWeight: 700,
              textTransform: "uppercase",
              color: "var(--accent-primary)",
              letterSpacing: "0.5px"
            }}>
                          📋 Proposed Kanban Cards Checklist
                        </h3>
                        <button onClick={() => {
              const newCard = {
                id: `custom-card-${Date.now()}`,
                title: "New Custom Task",
                description: "A customized task card for this sprint.",
                suggested_agent_role: "Software Engineer",
                suggested_agent_id: "",
                priority: "medium",
                status: "backlog",
                acceptance_criteria: ["Deliverables completed and validated."],
                required_files: [],
                related_files: [],
                dependencies: [],
                evidence_gate: "",
                review_required: false
              };
              setMissionPreview({
                ...missionPreview,
                proposed_cards: [...missionPreview.proposed_cards, newCard]
              });
            }} className="btn-primary" style={{
              padding: "6px 12px",
              fontSize: "0.76rem",
              borderRadius: "6px",
              background: "rgba(0,242,254,0.08)",
              color: "var(--accent-primary)",
              border: "1px solid rgba(0,242,254,0.2)"
            }}>
                          + Add Custom Card
                        </button>
                      </div>

                      <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px"
          }}>
                        {missionPreview.proposed_cards.map((card: any, idx: number) => <div key={card.id} className="card-glass" style={{
              padding: "16px 20px",
              borderRadius: "12px",
              border: "1px solid var(--border-color)",
              display: "grid",
              gridTemplateColumns: "1fr 220px 80px",
              gap: "20px",
              alignItems: "center",
              background: "rgba(255,255,255,0.01)"
            }}>
                            
                            {/* Card Content Edit */}
                            <div style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px"
              }}>
                              <input value={card.title} onChange={e => {
                  const updated = [...missionPreview.proposed_cards];
                  updated[idx].title = e.target.value;
                  setMissionPreview({
                    ...missionPreview,
                    proposed_cards: updated
                  });
                }} style={{
                  fontSize: "0.86rem",
                  fontWeight: "bold",
                  background: "none",
                  border: "none",
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                  color: "var(--text-main)",
                  padding: "2px 4px",
                  width: "100%"
                }} />
                              <input value={card.description} onChange={e => {
                  const updated = [...missionPreview.proposed_cards];
                  updated[idx].description = e.target.value;
                  setMissionPreview({
                    ...missionPreview,
                    proposed_cards: updated
                  });
                }} style={{
                  fontSize: "0.78rem",
                  background: "none",
                  border: "none",
                  color: "var(--text-muted)",
                  padding: "2px 4px",
                  width: "100%"
                }} />
                              <div style={{
                  fontSize: "0.7rem",
                  color: "var(--accent-secondary)",
                  opacity: 0.8
                }}>
                                <strong>Criteria:</strong> {card.acceptance_criteria.join(", ")}
                              </div>
                            </div>

                            {/* Card Attributes */}
                            <div style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px"
              }}>
                              <div>
                                <label style={{
                    display: "block",
                    fontSize: "0.68rem",
                    color: "var(--text-muted)",
                    marginBottom: "2px"
                  }}>Assigned Owner Role</label>
                                <select value={card.suggested_agent_role} onChange={e => {
                    const updated = [...missionPreview.proposed_cards];
                    updated[idx].suggested_agent_role = e.target.value;
                    setMissionPreview({
                      ...missionPreview,
                      proposed_cards: updated
                    });
                  }} style={{
                    width: "100%",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    background: "rgba(0,0,0,0.3)",
                    border: "1px solid var(--border-color)",
                    color: "var(--text-main)",
                    fontSize: "0.72rem"
                  }}>
                                  {missionPreview.proposed_agents.map((ag: any) => <option key={ag.role} value={ag.role}>{ag.role} ({ag.name})</option>)}
                                </select>
                              </div>

                              <div>
                                <label style={{
                    display: "block",
                    fontSize: "0.68rem",
                    color: "var(--text-muted)",
                    marginBottom: "2px"
                  }}>Priority</label>
                                <select value={card.priority} onChange={e => {
                    const updated = [...missionPreview.proposed_cards];
                    updated[idx].priority = e.target.value;
                    setMissionPreview({
                      ...missionPreview,
                      proposed_cards: updated
                    });
                  }} style={{
                    width: "100%",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    background: "rgba(0,0,0,0.3)",
                    border: "1px solid var(--border-color)",
                    color: "var(--text-main)",
                    fontSize: "0.72rem"
                  }}>
                                  <option value="high">High</option>
                                  <option value="medium">Medium</option>
                                  <option value="low">Low</option>
                                </select>
                              </div>
                            </div>

                            {/* Card Removal */}
                            <button onClick={() => {
                const updated = missionPreview.proposed_cards.filter((c: any) => c.id !== card.id);
                setMissionPreview({
                  ...missionPreview,
                  proposed_cards: updated
                });
              }} style={{
                background: "none",
                border: "none",
                color: "var(--color-blocked)",
                fontSize: "0.8rem",
                cursor: "pointer",
                alignSelf: "center"
              }}>
                              Delete
                            </button>

                          </div>)}
                      </div>
                    </div>

                    {/* Preview Apply Footer Action panel */}
                    <div className="card-glass" style={{
          padding: "20px",
          borderRadius: "12px",
          border: "1px solid var(--border-color)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "12px",
          background: "rgba(255,255,255,0.01)"
        }}>
                      <div style={{
            display: "flex",
            gap: "12px"
          }}>
                        <button onClick={handleApplyMission} className="btn-primary" style={{
              padding: "10px 20px",
              borderRadius: "8px",
              background: "linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)",
              border: "none",
              color: "#06080c",
              fontSize: "0.82rem",
              fontWeight: 700,
              cursor: "pointer"
            }}>
                          🚀 Approve & Launch Sprint
                        </button>
                        <button onClick={handleDiscardMission} className="btn-secondary" style={{
              padding: "10px 20px",
              borderRadius: "8px",
              background: "rgba(255,255,255,0.03)",
              border: "1px solid var(--border-color)",
              color: "var(--text-main)",
              fontSize: "0.82rem",
              cursor: "pointer"
            }}>
                          🚫 Discard Proposal
                        </button>
                      </div>

                      {/* Save As custom pack */}
                      <div style={{
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}>
                        <input value={customPackName} onChange={e => setCustomPackName(e.target.value)} placeholder="Pack Name (e.g. Tetris Sprint)" style={{
              padding: "8px 12px",
              borderRadius: "6px",
              background: "rgba(0,0,0,0.4)",
              border: "1px solid var(--border-color)",
              color: "var(--text-main)",
              fontSize: "0.78rem"
            }} />
                        <button onClick={handleSaveCustomPack} className="btn-primary" style={{
              padding: "8px 14px",
              borderRadius: "6px",
              background: "rgba(124, 77, 255, 0.15)",
              color: "var(--accent-primary)",
              border: "1px solid rgba(124, 77, 255, 0.3)",
              fontSize: "0.78rem",
              cursor: "pointer"
            }}>
                          💾 Save Pack
                        </button>
                      </div>
                    </div>
                  </>)}
              </div>
            </div>

          </div>)
    </>
  );
}