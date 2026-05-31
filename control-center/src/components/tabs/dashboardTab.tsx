import { useAppStore } from '../../hooks/useAppStore';

export function dashboardTab(props: ReturnType<typeof useAppStore>) {
  const { activeTab, setActiveTab, kanbanView, setKanbanView, refreshKanban, setRefreshKanban, suggestions, setSuggestions, templates, setTemplates, selectedTemplateKey, setSelectedTemplateKey, wizardCustomName, setWizardCustomName, decomposingTaskId, setDecomposingTaskId, decomposedProposals, setDecomposedProposals, localModels, setLocalModels, activeModel, setActiveModel, downloadState, setDownloadState, editAgentId, setEditAgentId, editName, setEditName, editRole, setEditRole, editPersona, setEditPersona, editProvider, setEditProvider, editModelName, setEditModelName, editTemp, setEditTemp, editMaxTokens, setEditMaxTokens, editSpawnSubtasks, setEditSpawnSubtasks, editTalkGlobally, setEditTalkGlobally, editContinuous, setEditContinuous, editParentAgentId, setEditParentAgentId, editAllowedTools, setEditAllowedTools, agents, setAgents, selectedAgentId, setSelectedAgentId, activeOrgNode, setActiveOrgNode, messages, setMessages, tasks, setTasks, selectedKanbanTask, setSelectedKanbanTask, outcomeGoal, setOutcomeGoal, selectedMissionPack, setSelectedMissionPack, missionPreview, setMissionPreview, missionPacks, setMissionPacks, customPackName, setCustomPackName, autopilotEnabled, setAutopilotEnabled, autopilotScope, setAutopilotScope, approvalRequirements, setApprovalRequirements, networkPermissions, setNetworkPermissions, doneApprovalRules, setDoneApprovalRules, missionAuditEvents, setMissionAuditEvents, activeMissions, setActiveMissions, activeContract, setActiveContract, activeReceipt, setActiveReceipt, modelsCatalog, setModelsCatalog, selectedModelForInspect, setSelectedModelForInspect, modelDetails, setModelDetails, remoteModels, setRemoteModels, modelsSearchQuery, setModelsSearchQuery, modelsFilterQuant, setModelsFilterQuant, modelsSubTab, setModelsSubTab, importPath, setImportPath, importCopy, setImportCopy, preflightReport, setPreflightReport, preflightLoading, setPreflightLoading, smokeTestResult, setSmokeTestResult, smokeTesting, setSmokeTesting, storageUsage, setStorageUsage, activeModelDetailTab, setActiveModelDetailTab, developerMode, setDeveloperMode, metadataSearch, setMetadataSearch, tensorSearch, setTensorSearch, backendStatus, setBackendStatus, backendLogs, setBackendLogs, formAutoStart, setFormAutoStart, formAutoRestart, setFormAutoRestart, formStopOnExit, setFormStopOnExit, formPort, setFormPort, formLogPath, setFormLogPath, formBinaryPath, setFormBinaryPath, formBindAddress, setFormBindAddress, formMaxRestarts, setFormMaxRestarts, formBackoffPolicy, setFormBackoffPolicy, loadMissionData, handleGenerateProposal, handleApplyMission, handleDiscardMission, handleSaveCustomPack, handleUpdateAutopilotSettings, detailCommentText, setDetailCommentText, blockerText, setBlockerText, blockedByTaskId, setBlockedByTaskId, evidenceText, setEvidenceText, validationPassed, setValidationPassed, validationNotes, setValidationNotes, completionError, setCompletionError, selectedCompletingAgentId, setSelectedCompletingAgentId, selectedClaimingAgentId, setSelectedClaimingAgentId, isCompletingTask, setIsCompletingTask, isAddingBlocker, setIsAddingBlocker, taskRequiredFiles, setTaskRequiredFiles, taskAcceptanceCriteria, setTaskAcceptanceCriteria, taskDependencies, setTaskDependencies, modalDetailsTab, setModalDetailsTab, timelineEntries, setTimelineEntries, blackboardText, setBlackboardText, inputText, setInputText, inspectorTab, setInspectorTab, coordinationDetails, setCoordinationDetails, newDecisionText, setNewDecisionText, artifacts, setArtifacts, selectedArtifactPath, setSelectedArtifactPath, selectedArtifactContent, setSelectedArtifactContent, modelPriority, setModelPriority, cpuUsage, setCpuUsage, ramUsage, setRamUsage, tps, setTps, selectAgentForEdit, isSpawnModalOpen, setIsSpawnModalOpen, isTaskModalOpen, setIsTaskModalOpen, spawnName, setSpawnName, spawnRole, setSpawnRole, spawnPersona, setSpawnPersona, spawnProvider, setSpawnProvider, spawnModel, setSpawnModel, spawnTemp, setSpawnTemp, spawnMaxTokens, setSpawnMaxTokens, spawnContinuous, setSpawnContinuous, spawnParentAgentId, setSpawnParentAgentId, spawnAllowedTools, setSpawnAllowedTools, taskTitle, setTaskTitle, taskDesc, setTaskDesc, taskOwner, setTaskOwner, taskPriority, setTaskPriority, ollamaUrl, setOllamaUrl, camelidUrl, setCamelidUrl, openaiKey, setOpenaiKey, anthropicKey, setAnthropicKey, blackboardInput, setBlackboardInput, isThinking, setIsThinking, feedEndRef, loadSuggestions, loadTemplates, handleCreateSoftwareTeam, handleCreateCodingSprint, handleLaunchAgent, handleDecompose, handleApproveSubtasks, handleResolveCommandApproval, handleSuggestionAction, loadArtifacts, handleSelectArtifact, loadLocalModels, loadModelCatalog, loadStorageUsage, handleRemoteSearch, handlePreflightCheck, handleDownloadModel, handlePauseDownload, handleCancelDownload, handleImportLocal, handleOpenModelInspect, handleActivateModelScopedSelect, handleRunSmokeLoadingTest, handleDeleteModelSecure, loadBackendStatus, handleCheckBackendHealth, handleRestartBackend, handleStopBackend, handleGetBackendLogs, handleOpenBackendLogs, handleSaveBackendConfig, handleResetBackendRuntime, loadAgents, loadMessages, loadTasks, loadBlackboard, loadCoordinationDetails, handleResolveHandoff, loadProviderConfigs, handleSendMessage, handleSpawnAgent, handleSaveAgentConfig, handleRetireAgent, safeParseJson, recommendAgentForTask, handleCreateTask, handleTransitionStatus, handleClaimCard, handleCompleteCard, handleAddComment, handleAddBlocker, handleToggleChecklistItem, handleDeleteAgent, handleSaveSettings, blockingOverlayStyle, glassCardStyle, overlayTitleStyle, renderBlockingOverlay } = props;

  return (
    <>
<div className="dashboard-container">
            {/* Dashboard Hero Banner */}
            <div className="dashboard-hero">
              <div className="hero-text">
                <h3>Autonomous AI Crew Operations</h3>
                <p>Natively powered by local GGUF models. Turnkey sprint coordination, safety command auditing, and active state recovery watchdog.</p>
              </div>
              <div className="hero-actions">
                <button className="hero-btn primary" onClick={handleCreateSoftwareTeam}>
                  Launch Software Team
                </button>
                <button className="hero-btn secondary" onClick={handleCreateCodingSprint}>
                  Bootstrap Coding Sprint
                </button>
              </div>
            </div>

            {/* Dashboard Operation Widgets */}
            <div className="dashboard-grid">
              
              {/* AI Crew Heartbeats Widget */}
              <div className="dashboard-card">
                <div className="card-header-group">
                  <div className="card-title">
                    <span style={{
            color: "var(--accent-primary)",
            marginRight: "8px"
          }}>●</span> Active Crew Heartbeats
                  </div>
                  <span className="telemetry-tag success" style={{
          textTransform: "capitalize"
        }}>{agents.length} specialist(s) active</span>
                </div>
                <div className="crew-grid">
                  {agents.map(agent => <div key={agent.id} className="crew-item">
                      <div className="crew-avatar">
                        {agent.name.charAt(0)}
                        <div className={`crew-status-dot ${agent.status}`} />
                      </div>
                      <div className="crew-name">{agent.name}</div>
                      <div className="crew-role">{agent.role}</div>
                      {agent.last_heartbeat && <div className="crew-hb">HB: {agent.last_heartbeat.slice(-4)}s</div>}
                    </div>)}
                </div>
              </div>

              {/* Work Suggestions Stream */}
              <div className="dashboard-card">
                <div className="card-header-group">
                  <div className="card-title">Next Best Actions</div>
                  <span style={{
          fontSize: "0.85rem",
          color: "var(--text-muted)"
        }}>{suggestions.length} suggestions</span>
                </div>
                <div className="dashboard-scrollable">
                  {suggestions.length === 0 ? <div style={{
          color: "var(--text-muted)",
          fontSize: "0.85rem",
          textAlign: "center",
          padding: "20px"
        }}>
                      All systems green. No blockers or idle specialists detected.
                    </div> : suggestions.map(sug => <div key={sug.id} className={`suggestion-card ${sug.severity}`}>
                        <div className="suggestion-header">
                          <span className={`suggestion-tag ${sug.severity}`}>{sug.suggestion_type}</span>
                          <span style={{
              fontSize: "0.75rem",
              color: "var(--text-muted)"
            }}>{sug.severity}</span>
                        </div>
                        <h4 style={{
            fontSize: "0.9rem",
            fontWeight: "bold"
          }}>{sug.title}</h4>
                        <div className="suggestion-desc">{sug.description}</div>
                        {sug.action_command && sug.action_label && <button className="suggestion-action-btn" onClick={() => handleSuggestionAction(sug.action_command!)}>
                            {sug.action_label}
                          </button>}
                      </div>)}
                </div>
              </div>

              {/* Turnkey Specialist Agent wizard */}
              <div className="dashboard-card">
                <div className="card-header-group">
                  <div className="card-title">Agent Builder Wizard</div>
                  <span style={{
          fontSize: "0.85rem",
          color: "var(--text-muted)"
        }}>10 templates ready</span>
                </div>
                <div className="wizard-templates-grid">
                  {templates.slice(0, 4).map(t => <div key={t.key} className={`wizard-template-card ${selectedTemplateKey === t.key ? "active" : ""}`} onClick={() => {
          setSelectedTemplateKey(t.key);
          setWizardCustomName(t.name);
        }}>
                      <h4>{t.name}</h4>
                      <p>{t.role}</p>
                    </div>)}
                </div>
                <div className="wizard-config-panel">
                  <div className="wizard-form-group">
                    <label>Agent Custom Call-Sign</label>
                    <input type="text" className="wizard-input" value={wizardCustomName} onChange={e => setWizardCustomName(e.target.value)} />
                  </div>
                  <div className="wizard-checkboxes">
                    <label className="wizard-checkbox-label">
                      <input type="checkbox" defaultChecked /> Full Files Access
                    </label>
                    <label className="wizard-checkbox-label">
                      <input type="checkbox" defaultChecked /> Shell execution
                    </label>
                    <label className="wizard-checkbox-label">
                      <input type="checkbox" defaultChecked /> Auto-Subtasks
                    </label>
                    <label className="wizard-checkbox-label">
                      <input type="checkbox" defaultChecked /> Review Required
                    </label>
                  </div>
                  <button className="wizard-submit-btn" onClick={handleLaunchAgent}>
                    Launch Agent specialist
                  </button>
                </div>
              </div>

              {/* Smart Subtask Decomposer widget */}
              <div className="dashboard-card">
                <div className="card-header-group">
                  <div className="card-title">Subtask Decomposer</div>
                  <span style={{
          fontSize: "0.85rem",
          color: "var(--text-muted)"
        }}>Sprint splitting tool</span>
                </div>
                <div className="decomposer-panel">
                  <div className="wizard-form-group">
                    <label>Choose Parent Task to split</label>
                    <select className="wizard-select" onChange={e => {
            if (e.target.value) {
              handleDecompose(e.target.value);
            }
          }}>
                      <option value="">-- Select Task Card --</option>
                      {tasks.filter(t => t.status !== "done" && t.status !== "blocked").map(t => <option key={t.id} value={t.id}>{t.title} ({t.status})</option>)}
                    </select>
                  </div>

                  {decomposedProposals.length > 0 && <div className="subtask-proposal-list">
                      <div style={{
            fontSize: "0.8rem",
            fontWeight: "bold",
            marginBottom: "6px"
          }}>Proposed Child Sprint Tree:</div>
                      <div className="dashboard-scrollable" style={{
            maxHeight: "140px"
          }}>
                        {decomposedProposals.map(prop => <div key={prop.id} className="subtask-proposal-item">
                            <div className="subtask-title-desc">
                              <h5>{prop.title}</h5>
                              <p>{prop.description}</p>
                            </div>
                            <div className="subtask-tags">
                              <span className="subtask-tag role">{prop.preferred_role}</span>
                              <span className={`subtask-tag priority-${prop.priority}`}>{prop.priority}</span>
                            </div>
                          </div>)}
                      </div>
                      <button className="wizard-submit-btn" style={{
            background: "linear-gradient(135deg, #10b981 0%, #059669 100%)"
          }} onClick={handleApproveSubtasks}>
                        Approve Child Sprint
                      </button>
                    </div>}
                </div>
              </div>

              {/* Command Guard & Security Reviews widget */}
              <div className="dashboard-card" style={{
      gridColumn: "span 2"
    }}>
                <div className="card-header-group">
                  <div className="card-title" style={{
          color: "var(--color-blocked)"
        }}>🛡️ Security Sandbox Review Queue</div>
                  <span className="telemetry-tag success" style={{
          background: "rgba(245, 158, 11, 0.1)",
          color: "var(--color-blocked)"
        }}>Audit Shield Active</span>
                </div>
                <div style={{
        display: "flex",
        flexDirection: "column",
        gap: "12px"
      }}>
                  {tasks.filter(t => t.status === "waiting_for_approval").length === 0 ? <div style={{
          fontSize: "0.85rem",
          color: "var(--text-muted)",
          textAlign: "center",
          padding: "10px"
        }}>
                      No blocked agent shell executions requiring security review.
                    </div> : tasks.filter(t => t.status === "waiting_for_approval").map(t => <div key={t.id} className="review-box" style={{
          border: "1px dashed var(--color-blocked)"
        }}>
                          <div style={{
            fontSize: "0.85rem",
            fontWeight: "bold"
          }}>
                            ⚠️ Security Warning: Card "{t.title}" is paused. An agent is requesting a high-risk system command execution!
                          </div>
                          <div style={{
            fontStyle: "italic",
            fontSize: "0.8rem",
            color: "var(--text-muted)"
          }}>
                            Review is mandatory under the default Moderate Safety Profile whitelist.
                          </div>
                          <div className="review-actions">
                            <button className="review-btn approve" onClick={() => handleResolveCommandApproval(t.id, true)}>
                              Approve & Resume
                            </button>
                            <button className="review-btn reject" onClick={() => handleResolveCommandApproval(t.id, false)}>
                              Reject & Block
                            </button>
                          </div>
                        </div>)}
                </div>
              </div>

            </div>
          </div>
    </>
  );
}