import { useAppStore } from '../../hooks/useAppStore';

export function channelsTab(props: ReturnType<typeof useAppStore>) {
  const { activeTab, setActiveTab, kanbanView, setKanbanView, refreshKanban, setRefreshKanban, suggestions, setSuggestions, templates, setTemplates, selectedTemplateKey, setSelectedTemplateKey, wizardCustomName, setWizardCustomName, decomposingTaskId, setDecomposingTaskId, decomposedProposals, setDecomposedProposals, localModels, setLocalModels, activeModel, setActiveModel, downloadState, setDownloadState, editAgentId, setEditAgentId, editName, setEditName, editRole, setEditRole, editPersona, setEditPersona, editProvider, setEditProvider, editModelName, setEditModelName, editTemp, setEditTemp, editMaxTokens, setEditMaxTokens, editSpawnSubtasks, setEditSpawnSubtasks, editTalkGlobally, setEditTalkGlobally, editContinuous, setEditContinuous, editParentAgentId, setEditParentAgentId, editAllowedTools, setEditAllowedTools, agents, setAgents, selectedAgentId, setSelectedAgentId, activeOrgNode, setActiveOrgNode, messages, setMessages, tasks, setTasks, selectedKanbanTask, setSelectedKanbanTask, outcomeGoal, setOutcomeGoal, selectedMissionPack, setSelectedMissionPack, missionPreview, setMissionPreview, missionPacks, setMissionPacks, customPackName, setCustomPackName, autopilotEnabled, setAutopilotEnabled, autopilotScope, setAutopilotScope, approvalRequirements, setApprovalRequirements, networkPermissions, setNetworkPermissions, doneApprovalRules, setDoneApprovalRules, missionAuditEvents, setMissionAuditEvents, activeMissions, setActiveMissions, activeContract, setActiveContract, activeReceipt, setActiveReceipt, modelsCatalog, setModelsCatalog, selectedModelForInspect, setSelectedModelForInspect, modelDetails, setModelDetails, remoteModels, setRemoteModels, modelsSearchQuery, setModelsSearchQuery, modelsFilterQuant, setModelsFilterQuant, modelsSubTab, setModelsSubTab, importPath, setImportPath, importCopy, setImportCopy, preflightReport, setPreflightReport, preflightLoading, setPreflightLoading, smokeTestResult, setSmokeTestResult, smokeTesting, setSmokeTesting, storageUsage, setStorageUsage, activeModelDetailTab, setActiveModelDetailTab, developerMode, setDeveloperMode, metadataSearch, setMetadataSearch, tensorSearch, setTensorSearch, backendStatus, setBackendStatus, backendLogs, setBackendLogs, formAutoStart, setFormAutoStart, formAutoRestart, setFormAutoRestart, formStopOnExit, setFormStopOnExit, formPort, setFormPort, formLogPath, setFormLogPath, formBinaryPath, setFormBinaryPath, formBindAddress, setFormBindAddress, formMaxRestarts, setFormMaxRestarts, formBackoffPolicy, setFormBackoffPolicy, loadMissionData, handleGenerateProposal, handleApplyMission, handleDiscardMission, handleSaveCustomPack, handleUpdateAutopilotSettings, detailCommentText, setDetailCommentText, blockerText, setBlockerText, blockedByTaskId, setBlockedByTaskId, evidenceText, setEvidenceText, validationPassed, setValidationPassed, validationNotes, setValidationNotes, completionError, setCompletionError, selectedCompletingAgentId, setSelectedCompletingAgentId, selectedClaimingAgentId, setSelectedClaimingAgentId, isCompletingTask, setIsCompletingTask, isAddingBlocker, setIsAddingBlocker, taskRequiredFiles, setTaskRequiredFiles, taskAcceptanceCriteria, setTaskAcceptanceCriteria, taskDependencies, setTaskDependencies, modalDetailsTab, setModalDetailsTab, timelineEntries, setTimelineEntries, blackboardText, setBlackboardText, inputText, setInputText, inspectorTab, setInspectorTab, coordinationDetails, setCoordinationDetails, newDecisionText, setNewDecisionText, artifacts, setArtifacts, selectedArtifactPath, setSelectedArtifactPath, selectedArtifactContent, setSelectedArtifactContent, modelPriority, setModelPriority, cpuUsage, setCpuUsage, ramUsage, setRamUsage, tps, setTps, selectAgentForEdit, isSpawnModalOpen, setIsSpawnModalOpen, isTaskModalOpen, setIsTaskModalOpen, spawnName, setSpawnName, spawnRole, setSpawnRole, spawnPersona, setSpawnPersona, spawnProvider, setSpawnProvider, spawnModel, setSpawnModel, spawnTemp, setSpawnTemp, spawnMaxTokens, setSpawnMaxTokens, spawnContinuous, setSpawnContinuous, spawnParentAgentId, setSpawnParentAgentId, spawnAllowedTools, setSpawnAllowedTools, taskTitle, setTaskTitle, taskDesc, setTaskDesc, taskOwner, setTaskOwner, taskPriority, setTaskPriority, ollamaUrl, setOllamaUrl, camelidUrl, setCamelidUrl, openaiKey, setOpenaiKey, anthropicKey, setAnthropicKey, blackboardInput, setBlackboardInput, isThinking, setIsThinking, feedEndRef, loadSuggestions, loadTemplates, handleCreateSoftwareTeam, handleCreateCodingSprint, handleLaunchAgent, handleDecompose, handleApproveSubtasks, handleResolveCommandApproval, handleSuggestionAction, loadArtifacts, handleSelectArtifact, loadLocalModels, loadModelCatalog, loadStorageUsage, handleRemoteSearch, handlePreflightCheck, handleDownloadModel, handlePauseDownload, handleCancelDownload, handleImportLocal, handleOpenModelInspect, handleActivateModelScopedSelect, handleRunSmokeLoadingTest, handleDeleteModelSecure, loadBackendStatus, handleCheckBackendHealth, handleRestartBackend, handleStopBackend, handleGetBackendLogs, handleOpenBackendLogs, handleSaveBackendConfig, handleResetBackendRuntime, loadAgents, loadMessages, loadTasks, loadBlackboard, loadCoordinationDetails, handleResolveHandoff, loadProviderConfigs, handleSendMessage, handleSpawnAgent, handleSaveAgentConfig, handleRetireAgent, safeParseJson, recommendAgentForTask, handleCreateTask, handleTransitionStatus, handleClaimCard, handleCompleteCard, handleAddComment, handleAddBlocker, handleToggleChecklistItem, handleDeleteAgent, handleSaveSettings, blockingOverlayStyle, glassCardStyle, overlayTitleStyle, renderBlockingOverlay } = props;

  return (
    <>
(/* Channels Page */
<div className="channels-container" style={{
  flex: 1,
  overflowY: "auto",
  padding: "24px"
}}>
            <div className="channels-header-section" style={{
    marginBottom: "20px"
  }}>
              <h3 className="section-subtitle" style={{
      fontSize: "1.1rem",
      fontWeight: 600,
      color: "var(--accent-primary)"
    }}>💬 External Messaging Channels</h3>
              <p className="section-desc" style={{
      fontSize: "0.85rem",
      color: "var(--text-muted)",
      marginTop: "4px"
    }}>Pair and audit external communication interfaces. Senders must be approved via the Pairing Code protocol before accessing workspace agents.</p>
            </div>
            <div className="channels-grid" style={{
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
    gap: "16px"
  }}>
              {[{
      id: "telegram",
      name: "Telegram Gateway",
      icon: "✈️",
      status: "Active & Paired",
      statusCode: "online",
      desc: "Listening on bot endpoint with default pairing policy enabled.",
      metric: "Connected as @Cameleer_Bot"
    }, {
      id: "discord",
      name: "Discord Bot Integration",
      icon: "🎮",
      status: "Active & Paired",
      statusCode: "online",
      desc: "Multi-agent guild listener paired successfully.",
      metric: "Active in 2 server guilds"
    }, {
      id: "whatsapp",
      name: "WhatsApp Personal Pair",
      icon: "💬",
      status: "Pairing Required (QR Code)",
      statusCode: "pairing",
      desc: "Awaiting QR scan verification to initialize session flow.",
      metric: "Click to generate pairing barcode"
    }, {
      id: "slack",
      name: "Slack Workplace Node",
      icon: "💼",
      status: "Inactive",
      statusCode: "offline",
      desc: "Slack bot user token is missing. Configure in settings.",
      metric: "Not configured"
    }].map(channel => <div key={channel.id} className="channel-card" style={{
      background: "rgba(255,255,255,0.02)",
      border: "1px solid var(--border-color)",
      borderRadius: "14px",
      padding: "20px",
      display: "flex",
      flexDirection: "column",
      gap: "14px"
    }}>
                  <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}>
                    <div style={{
          display: "flex",
          alignItems: "center",
          gap: "8px"
        }}>
                      <span style={{
            fontSize: "1.25rem"
          }}>{channel.icon}</span>
                      <h4 style={{
            fontWeight: 600,
            fontSize: "0.95rem"
          }}>{channel.name}</h4>
                    </div>
                    <span style={{
          fontSize: "0.7rem",
          color: channel.statusCode === "online" ? "var(--color-working)" : channel.statusCode === "pairing" ? "var(--color-blocked)" : "var(--text-muted)",
          background: channel.statusCode === "online" ? "rgba(16,185,129,0.1)" : channel.statusCode === "pairing" ? "rgba(245,158,11,0.1)" : "rgba(255,255,255,0.05)",
          padding: "2px 8px",
          borderRadius: "8px",
          fontWeight: 600
        }}>{channel.status}</span>
                  </div>
                  <p style={{
        fontSize: "0.8rem",
        color: "var(--text-muted)",
        lineHeight: 1.4
      }}>{channel.desc}</p>
                  
                  {channel.statusCode === "pairing" && <div style={{
        background: "rgba(0,0,0,0.2)",
        borderRadius: "8px",
        padding: "12px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "8px"
      }}>
                      <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "2px",
          fontFamily: "monospace",
          fontSize: "10px",
          color: "var(--accent-primary)",
          opacity: 0.8
        }}>
                        <div>■ ■   ■ ■ ■</div>
                        <div>■     ■ ■  </div>
                        <div>■ ■ ■   ■ ■</div>
                        <div>■   ■ ■ ■  </div>
                      </div>
                      <span style={{
          fontSize: "0.68rem",
          color: "var(--text-muted)"
        }}>Scan QR Code with WhatsApp Web Link</span>
                    </div>}

                  <div style={{
        borderTop: "1px solid rgba(255,255,255,0.04)",
        paddingTop: "10px"
      }}>
                    <div style={{
          fontSize: "0.7rem",
          color: "var(--text-muted)"
        }}>Gateway Details:</div>
                    <div style={{
          fontSize: "0.8rem",
          fontWeight: 600,
          color: "var(--accent-primary)",
          marginTop: "2px"
        }}>{channel.metric}</div>
                  </div>
                </div>)}
            </div>
          </div>)
    </>
  );
}