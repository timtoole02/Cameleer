import { useAppStore } from '../../hooks/useAppStore';

export function filesTab(props: ReturnType<typeof useAppStore>) {
  const { activeTab, setActiveTab, kanbanView, setKanbanView, refreshKanban, setRefreshKanban, suggestions, setSuggestions, templates, setTemplates, selectedTemplateKey, setSelectedTemplateKey, wizardCustomName, setWizardCustomName, decomposingTaskId, setDecomposingTaskId, decomposedProposals, setDecomposedProposals, localModels, setLocalModels, activeModel, setActiveModel, downloadState, setDownloadState, editAgentId, setEditAgentId, editName, setEditName, editRole, setEditRole, editPersona, setEditPersona, editProvider, setEditProvider, editModelName, setEditModelName, editTemp, setEditTemp, editMaxTokens, setEditMaxTokens, editSpawnSubtasks, setEditSpawnSubtasks, editTalkGlobally, setEditTalkGlobally, editContinuous, setEditContinuous, editParentAgentId, setEditParentAgentId, editAllowedTools, setEditAllowedTools, agents, setAgents, selectedAgentId, setSelectedAgentId, activeOrgNode, setActiveOrgNode, messages, setMessages, tasks, setTasks, selectedKanbanTask, setSelectedKanbanTask, outcomeGoal, setOutcomeGoal, selectedMissionPack, setSelectedMissionPack, missionPreview, setMissionPreview, missionPacks, setMissionPacks, customPackName, setCustomPackName, autopilotEnabled, setAutopilotEnabled, autopilotScope, setAutopilotScope, approvalRequirements, setApprovalRequirements, networkPermissions, setNetworkPermissions, doneApprovalRules, setDoneApprovalRules, missionAuditEvents, setMissionAuditEvents, activeMissions, setActiveMissions, activeContract, setActiveContract, activeReceipt, setActiveReceipt, modelsCatalog, setModelsCatalog, selectedModelForInspect, setSelectedModelForInspect, modelDetails, setModelDetails, remoteModels, setRemoteModels, modelsSearchQuery, setModelsSearchQuery, modelsFilterQuant, setModelsFilterQuant, modelsSubTab, setModelsSubTab, importPath, setImportPath, importCopy, setImportCopy, preflightReport, setPreflightReport, preflightLoading, setPreflightLoading, smokeTestResult, setSmokeTestResult, smokeTesting, setSmokeTesting, storageUsage, setStorageUsage, activeModelDetailTab, setActiveModelDetailTab, developerMode, setDeveloperMode, metadataSearch, setMetadataSearch, tensorSearch, setTensorSearch, backendStatus, setBackendStatus, backendLogs, setBackendLogs, formAutoStart, setFormAutoStart, formAutoRestart, setFormAutoRestart, formStopOnExit, setFormStopOnExit, formPort, setFormPort, formLogPath, setFormLogPath, formBinaryPath, setFormBinaryPath, formBindAddress, setFormBindAddress, formMaxRestarts, setFormMaxRestarts, formBackoffPolicy, setFormBackoffPolicy, loadMissionData, handleGenerateProposal, handleApplyMission, handleDiscardMission, handleSaveCustomPack, handleUpdateAutopilotSettings, detailCommentText, setDetailCommentText, blockerText, setBlockerText, blockedByTaskId, setBlockedByTaskId, evidenceText, setEvidenceText, validationPassed, setValidationPassed, validationNotes, setValidationNotes, completionError, setCompletionError, selectedCompletingAgentId, setSelectedCompletingAgentId, selectedClaimingAgentId, setSelectedClaimingAgentId, isCompletingTask, setIsCompletingTask, isAddingBlocker, setIsAddingBlocker, taskRequiredFiles, setTaskRequiredFiles, taskAcceptanceCriteria, setTaskAcceptanceCriteria, taskDependencies, setTaskDependencies, modalDetailsTab, setModalDetailsTab, timelineEntries, setTimelineEntries, blackboardText, setBlackboardText, inputText, setInputText, inspectorTab, setInspectorTab, coordinationDetails, setCoordinationDetails, newDecisionText, setNewDecisionText, artifacts, setArtifacts, selectedArtifactPath, setSelectedArtifactPath, selectedArtifactContent, setSelectedArtifactContent, modelPriority, setModelPriority, cpuUsage, setCpuUsage, ramUsage, setRamUsage, tps, setTps, selectAgentForEdit, isSpawnModalOpen, setIsSpawnModalOpen, isTaskModalOpen, setIsTaskModalOpen, spawnName, setSpawnName, spawnRole, setSpawnRole, spawnPersona, setSpawnPersona, spawnProvider, setSpawnProvider, spawnModel, setSpawnModel, spawnTemp, setSpawnTemp, spawnMaxTokens, setSpawnMaxTokens, spawnContinuous, setSpawnContinuous, spawnParentAgentId, setSpawnParentAgentId, spawnAllowedTools, setSpawnAllowedTools, taskTitle, setTaskTitle, taskDesc, setTaskDesc, taskOwner, setTaskOwner, taskPriority, setTaskPriority, ollamaUrl, setOllamaUrl, camelidUrl, setCamelidUrl, openaiKey, setOpenaiKey, anthropicKey, setAnthropicKey, blackboardInput, setBlackboardInput, isThinking, setIsThinking, feedEndRef, loadSuggestions, loadTemplates, handleCreateSoftwareTeam, handleCreateCodingSprint, handleLaunchAgent, handleDecompose, handleApproveSubtasks, handleResolveCommandApproval, handleSuggestionAction, loadArtifacts, handleSelectArtifact, loadLocalModels, loadModelCatalog, loadStorageUsage, handleRemoteSearch, handlePreflightCheck, handleDownloadModel, handlePauseDownload, handleCancelDownload, handleImportLocal, handleOpenModelInspect, handleActivateModelScopedSelect, handleRunSmokeLoadingTest, handleDeleteModelSecure, loadBackendStatus, handleCheckBackendHealth, handleRestartBackend, handleStopBackend, handleGetBackendLogs, handleOpenBackendLogs, handleSaveBackendConfig, handleResetBackendRuntime, loadAgents, loadMessages, loadTasks, loadBlackboard, loadCoordinationDetails, handleResolveHandoff, loadProviderConfigs, handleSendMessage, handleSpawnAgent, handleSaveAgentConfig, handleRetireAgent, safeParseJson, recommendAgentForTask, handleCreateTask, handleTransitionStatus, handleClaimCard, handleCompleteCard, handleAddComment, handleAddBlocker, handleToggleChecklistItem, handleDeleteAgent, handleSaveSettings, blockingOverlayStyle, glassCardStyle, overlayTitleStyle, renderBlockingOverlay } = props;

  return (
    <>
(/* Files Page */
<div className="files-container" style={{
  flex: 1,
  display: "flex",
  height: "100%",
  overflow: "hidden"
}}>
            <div className="files-sidebar" style={{
    width: "240px",
    borderRight: "1px solid var(--border-color)",
    background: "rgba(0,0,0,0.15)",
    display: "flex",
    flexDirection: "column",
    overflowY: "auto"
  }}>
              <div style={{
      padding: "16px",
      fontSize: "0.78rem",
      fontWeight: 700,
      textTransform: "uppercase",
      color: "var(--text-muted)",
      borderBottom: "1px solid var(--border-color)"
    }}>Workspace Files</div>
              <div className="files-list" style={{
      flex: 1,
      padding: "8px"
    }}>
                {artifacts.length === 0 ? <div style={{
        padding: "20px",
        fontSize: "0.78rem",
        color: "var(--text-muted)",
        textAlign: "center"
      }}>No files generated by agent sandbox yet. Try asking your Coder to save a file!</div> : artifacts.map(art => {
        const parts = art.path.split("/");
        const filename = parts[parts.length - 1];
        let icon = "📄";
        if (filename.endsWith(".rs")) icon = "🦀";
        if (filename.endsWith(".py")) icon = "🐍";
        if (filename.endsWith(".json")) icon = "📦";
        if (filename.endsWith(".md")) icon = "📝";
        return <div key={art.path} className={`file-item ${selectedArtifactPath === art.path ? "active" : ""}`} onClick={() => handleSelectArtifact(art.path)} style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "8px 12px",
          borderRadius: "8px",
          cursor: "pointer",
          marginBottom: "4px",
          transition: "all 0.2s ease",
          background: selectedArtifactPath === art.path ? "rgba(0,242,254,0.06)" : "transparent",
          border: selectedArtifactPath === art.path ? "1px solid rgba(0,242,254,0.15)" : "1px solid transparent"
        }}>
                        <span style={{
            fontSize: "1.1rem"
          }}>{icon}</span>
                        <div style={{
            display: "flex",
            flexDirection: "column",
            minWidth: 0
          }}>
                          <span style={{
              fontSize: "0.8rem",
              fontWeight: 600,
              color: "var(--text-main)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            }}>{filename}</span>
                          <span style={{
              fontSize: "0.68rem",
              color: "var(--text-muted)"
            }}>{art.artifact_type}</span>
                        </div>
                      </div>;
      })}
              </div>
            </div>
            <div className="files-preview-pane" style={{
    flex: 1,
    display: "flex",
    flexDirection: "column",
    background: "rgba(0,0,0,0.25)",
    overflow: "hidden"
  }}>
              <div className="files-preview-header" style={{
      padding: "12px 20px",
      borderBottom: "1px solid var(--border-color)",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    }}>
                <span style={{
        fontSize: "0.8rem",
        fontWeight: 600,
        color: "var(--accent-primary)",
        fontFamily: "var(--font-mono)"
      }}>
                  {selectedArtifactPath || "No file selected"}
                </span>
                <span style={{
        fontSize: "0.7rem",
        color: "var(--text-muted)"
      }}>Workspace Frame View</span>
              </div>
              <pre className="files-code-editor" style={{
      flex: 1,
      margin: 0,
      padding: "20px",
      overflow: "auto",
      background: "transparent",
      color: "#e2e8f0",
      fontFamily: "var(--font-mono)",
      fontSize: "0.82rem",
      lineHeight: 1.5,
      whiteSpace: "pre-wrap"
    }}>
                <code>{selectedArtifactContent || "// Select a workspace file from the left column to view its live contents."}</code>
              </pre>
            </div>
          </div>)
    </>
  );
}