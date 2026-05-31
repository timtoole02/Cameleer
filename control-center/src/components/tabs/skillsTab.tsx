import { useAppStore } from '../../hooks/useAppStore';

export function skillsTab(props: ReturnType<typeof useAppStore>) {
  const { activeTab, setActiveTab, kanbanView, setKanbanView, refreshKanban, setRefreshKanban, suggestions, setSuggestions, templates, setTemplates, selectedTemplateKey, setSelectedTemplateKey, wizardCustomName, setWizardCustomName, decomposingTaskId, setDecomposingTaskId, decomposedProposals, setDecomposedProposals, localModels, setLocalModels, activeModel, setActiveModel, downloadState, setDownloadState, editAgentId, setEditAgentId, editName, setEditName, editRole, setEditRole, editPersona, setEditPersona, editProvider, setEditProvider, editModelName, setEditModelName, editTemp, setEditTemp, editMaxTokens, setEditMaxTokens, editSpawnSubtasks, setEditSpawnSubtasks, editTalkGlobally, setEditTalkGlobally, editContinuous, setEditContinuous, editParentAgentId, setEditParentAgentId, editAllowedTools, setEditAllowedTools, agents, setAgents, selectedAgentId, setSelectedAgentId, activeOrgNode, setActiveOrgNode, messages, setMessages, tasks, setTasks, selectedKanbanTask, setSelectedKanbanTask, outcomeGoal, setOutcomeGoal, selectedMissionPack, setSelectedMissionPack, missionPreview, setMissionPreview, missionPacks, setMissionPacks, customPackName, setCustomPackName, autopilotEnabled, setAutopilotEnabled, autopilotScope, setAutopilotScope, approvalRequirements, setApprovalRequirements, networkPermissions, setNetworkPermissions, doneApprovalRules, setDoneApprovalRules, missionAuditEvents, setMissionAuditEvents, activeMissions, setActiveMissions, activeContract, setActiveContract, activeReceipt, setActiveReceipt, modelsCatalog, setModelsCatalog, selectedModelForInspect, setSelectedModelForInspect, modelDetails, setModelDetails, remoteModels, setRemoteModels, modelsSearchQuery, setModelsSearchQuery, modelsFilterQuant, setModelsFilterQuant, modelsSubTab, setModelsSubTab, importPath, setImportPath, importCopy, setImportCopy, preflightReport, setPreflightReport, preflightLoading, setPreflightLoading, smokeTestResult, setSmokeTestResult, smokeTesting, setSmokeTesting, storageUsage, setStorageUsage, activeModelDetailTab, setActiveModelDetailTab, developerMode, setDeveloperMode, metadataSearch, setMetadataSearch, tensorSearch, setTensorSearch, backendStatus, setBackendStatus, backendLogs, setBackendLogs, formAutoStart, setFormAutoStart, formAutoRestart, setFormAutoRestart, formStopOnExit, setFormStopOnExit, formPort, setFormPort, formLogPath, setFormLogPath, formBinaryPath, setFormBinaryPath, formBindAddress, setFormBindAddress, formMaxRestarts, setFormMaxRestarts, formBackoffPolicy, setFormBackoffPolicy, loadMissionData, handleGenerateProposal, handleApplyMission, handleDiscardMission, handleSaveCustomPack, handleUpdateAutopilotSettings, detailCommentText, setDetailCommentText, blockerText, setBlockerText, blockedByTaskId, setBlockedByTaskId, evidenceText, setEvidenceText, validationPassed, setValidationPassed, validationNotes, setValidationNotes, completionError, setCompletionError, selectedCompletingAgentId, setSelectedCompletingAgentId, selectedClaimingAgentId, setSelectedClaimingAgentId, isCompletingTask, setIsCompletingTask, isAddingBlocker, setIsAddingBlocker, taskRequiredFiles, setTaskRequiredFiles, taskAcceptanceCriteria, setTaskAcceptanceCriteria, taskDependencies, setTaskDependencies, modalDetailsTab, setModalDetailsTab, timelineEntries, setTimelineEntries, blackboardText, setBlackboardText, inputText, setInputText, inspectorTab, setInspectorTab, coordinationDetails, setCoordinationDetails, newDecisionText, setNewDecisionText, artifacts, setArtifacts, selectedArtifactPath, setSelectedArtifactPath, selectedArtifactContent, setSelectedArtifactContent, modelPriority, setModelPriority, cpuUsage, setCpuUsage, ramUsage, setRamUsage, tps, setTps, selectAgentForEdit, isSpawnModalOpen, setIsSpawnModalOpen, isTaskModalOpen, setIsTaskModalOpen, spawnName, setSpawnName, spawnRole, setSpawnRole, spawnPersona, setSpawnPersona, spawnProvider, setSpawnProvider, spawnModel, setSpawnModel, spawnTemp, setSpawnTemp, spawnMaxTokens, setSpawnMaxTokens, spawnContinuous, setSpawnContinuous, spawnParentAgentId, setSpawnParentAgentId, spawnAllowedTools, setSpawnAllowedTools, taskTitle, setTaskTitle, taskDesc, setTaskDesc, taskOwner, setTaskOwner, taskPriority, setTaskPriority, ollamaUrl, setOllamaUrl, camelidUrl, setCamelidUrl, openaiKey, setOpenaiKey, anthropicKey, setAnthropicKey, blackboardInput, setBlackboardInput, isThinking, setIsThinking, feedEndRef, loadSuggestions, loadTemplates, handleCreateSoftwareTeam, handleCreateCodingSprint, handleLaunchAgent, handleDecompose, handleApproveSubtasks, handleResolveCommandApproval, handleSuggestionAction, loadArtifacts, handleSelectArtifact, loadLocalModels, loadModelCatalog, loadStorageUsage, handleRemoteSearch, handlePreflightCheck, handleDownloadModel, handlePauseDownload, handleCancelDownload, handleImportLocal, handleOpenModelInspect, handleActivateModelScopedSelect, handleRunSmokeLoadingTest, handleDeleteModelSecure, loadBackendStatus, handleCheckBackendHealth, handleRestartBackend, handleStopBackend, handleGetBackendLogs, handleOpenBackendLogs, handleSaveBackendConfig, handleResetBackendRuntime, loadAgents, loadMessages, loadTasks, loadBlackboard, loadCoordinationDetails, handleResolveHandoff, loadProviderConfigs, handleSendMessage, handleSpawnAgent, handleSaveAgentConfig, handleRetireAgent, safeParseJson, recommendAgentForTask, handleCreateTask, handleTransitionStatus, handleClaimCard, handleCompleteCard, handleAddComment, handleAddBlocker, handleToggleChecklistItem, handleDeleteAgent, handleSaveSettings, blockingOverlayStyle, glassCardStyle, overlayTitleStyle, renderBlockingOverlay } = props;

  return (
    <>
(/* Skills Page */
<div className="skills-container" style={{
  flex: 1,
  overflowY: "auto",
  padding: "24px"
}}>
            <div className="skills-header-section" style={{
    marginBottom: "20px"
  }}>
              <h3 className="section-subtitle" style={{
      fontSize: "1.1rem",
      fontWeight: 600,
      color: "var(--accent-primary)"
    }}>🔧 Whitelisted Skill Registry</h3>
              <p className="section-desc" style={{
      fontSize: "0.85rem",
      color: "var(--text-muted)",
      marginTop: "4px"
    }}>These modular playbooks define host capabilities the agents can autonomously orchestrate under human sandbox boundaries.</p>
            </div>
            <div className="skills-grid" style={{
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: "16px"
  }}>
              {[{
      id: "file-write",
      name: "File Saver & Mutator",
      desc: "Physically saves and updates files on host directories, specifically whitelisted to Desktop. Automatically parses annotations inside markdown blocks.",
      tools: ["std::fs::write", "std::fs::create_dir_all"],
      inputs: ["path", "content"],
      status: "Active & Whitelisted"
    }, {
      id: "shell-exec",
      name: "Host Shell Executor",
      desc: "Launches shell commands via standard command processes, dynamically feeding outcomes back to agent memory blocks. Safely blocks recursive deletion flags.",
      tools: ["std::process::Command"],
      inputs: ["command"],
      status: "Active & Whitelisted"
    }, {
      id: "system-info",
      name: "System Profiler",
      desc: "Checks current operating system platforms, gathers active hardware statistics, processes, and logs, compiling rich Markdown system reports.",
      tools: ["df -h", "ifconfig", "uname", "ps"],
      inputs: [],
      status: "Active & Whitelisted"
    }, {
      id: "multi-agent",
      name: "Blackboard Crew Orchestrator",
      desc: "Triggers joint coordination by feeding the shared awareness blackboard context to multiple agents, allowing concurrent planning and consensus.",
      tools: ["Blackboard Context Engine"],
      inputs: ["shared_objective"],
      status: "Active & Whitelisted"
    }, {
      id: "web-crawler",
      name: "HTML Client & Crawler",
      desc: "Fetches live web content and APIs using curl under whitelisted network proxies, giving agents basic internet search and read capabilities.",
      tools: ["curl", "wttr.in"],
      inputs: ["url"],
      status: "Active & Whitelisted"
    }].map(skill => <div key={skill.id} className="skill-card" style={{
      background: "rgba(255,255,255,0.02)",
      border: "1px solid var(--border-color)",
      borderRadius: "14px",
      padding: "20px",
      display: "flex",
      flexDirection: "column",
      gap: "12px"
    }}>
                  <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}>
                    <h4 style={{
          fontWeight: 600,
          fontSize: "0.95rem"
        }}>🔧 {skill.name}</h4>
                    <span style={{
          fontSize: "0.7rem",
          color: "var(--color-working)",
          background: "rgba(16,185,129,0.1)",
          padding: "2px 8px",
          borderRadius: "8px",
          fontWeight: 600
        }}>{skill.status}</span>
                  </div>
                  <p style={{
        fontSize: "0.8rem",
        color: "var(--text-muted)",
        lineHeight: 1.4
      }}>{skill.desc}</p>
                  
                  <div>
                    <div style={{
          fontSize: "0.75rem",
          color: "var(--text-muted)",
          fontWeight: 600,
          marginBottom: "4px"
        }}>System Tools Used:</div>
                    <div style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "4px"
        }}>
                      {skill.tools.map((t, i) => <span key={i} style={{
            fontSize: "0.7rem",
            fontFamily: "var(--font-mono)",
            background: "rgba(0,242,254,0.08)",
            color: "var(--accent-primary)",
            padding: "2px 6px",
            borderRadius: "4px"
          }}>{t}</span>)}
                    </div>
                  </div>

                  {skill.inputs.length > 0 && <div>
                      <div style={{
          fontSize: "0.75rem",
          color: "var(--text-muted)",
          fontWeight: 600,
          marginBottom: "4px"
        }}>Parameters Required:</div>
                      <div style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "4px"
        }}>
                        {skill.inputs.map((inp, i) => <span key={i} style={{
            fontSize: "0.7rem",
            background: "rgba(255,255,255,0.05)",
            color: "var(--text-main)",
            padding: "2px 6px",
            borderRadius: "4px"
          }}>{inp}</span>)}
                      </div>
                    </div>}
                </div>)}
            </div>
          </div>)
    </>
  );
}