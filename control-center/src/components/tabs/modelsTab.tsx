import { useAppStore } from '../../hooks/useAppStore';

export function modelsTab(props: ReturnType<typeof useAppStore>) {
  const { activeTab, setActiveTab, kanbanView, setKanbanView, refreshKanban, setRefreshKanban, suggestions, setSuggestions, templates, setTemplates, selectedTemplateKey, setSelectedTemplateKey, wizardCustomName, setWizardCustomName, decomposingTaskId, setDecomposingTaskId, decomposedProposals, setDecomposedProposals, localModels, setLocalModels, activeModel, setActiveModel, downloadState, setDownloadState, editAgentId, setEditAgentId, editName, setEditName, editRole, setEditRole, editPersona, setEditPersona, editProvider, setEditProvider, editModelName, setEditModelName, editTemp, setEditTemp, editMaxTokens, setEditMaxTokens, editSpawnSubtasks, setEditSpawnSubtasks, editTalkGlobally, setEditTalkGlobally, editContinuous, setEditContinuous, editParentAgentId, setEditParentAgentId, editAllowedTools, setEditAllowedTools, agents, setAgents, selectedAgentId, setSelectedAgentId, activeOrgNode, setActiveOrgNode, messages, setMessages, tasks, setTasks, selectedKanbanTask, setSelectedKanbanTask, outcomeGoal, setOutcomeGoal, selectedMissionPack, setSelectedMissionPack, missionPreview, setMissionPreview, missionPacks, setMissionPacks, customPackName, setCustomPackName, autopilotEnabled, setAutopilotEnabled, autopilotScope, setAutopilotScope, approvalRequirements, setApprovalRequirements, networkPermissions, setNetworkPermissions, doneApprovalRules, setDoneApprovalRules, missionAuditEvents, setMissionAuditEvents, activeMissions, setActiveMissions, activeContract, setActiveContract, activeReceipt, setActiveReceipt, modelsCatalog, setModelsCatalog, selectedModelForInspect, setSelectedModelForInspect, modelDetails, setModelDetails, remoteModels, setRemoteModels, modelsSearchQuery, setModelsSearchQuery, modelsFilterQuant, setModelsFilterQuant, modelsSubTab, setModelsSubTab, importPath, setImportPath, importCopy, setImportCopy, preflightReport, setPreflightReport, preflightLoading, setPreflightLoading, smokeTestResult, setSmokeTestResult, smokeTesting, setSmokeTesting, storageUsage, setStorageUsage, activeModelDetailTab, setActiveModelDetailTab, developerMode, setDeveloperMode, metadataSearch, setMetadataSearch, tensorSearch, setTensorSearch, backendStatus, setBackendStatus, backendLogs, setBackendLogs, formAutoStart, setFormAutoStart, formAutoRestart, setFormAutoRestart, formStopOnExit, setFormStopOnExit, formPort, setFormPort, formLogPath, setFormLogPath, formBinaryPath, setFormBinaryPath, formBindAddress, setFormBindAddress, formMaxRestarts, setFormMaxRestarts, formBackoffPolicy, setFormBackoffPolicy, loadMissionData, handleGenerateProposal, handleApplyMission, handleDiscardMission, handleSaveCustomPack, handleUpdateAutopilotSettings, detailCommentText, setDetailCommentText, blockerText, setBlockerText, blockedByTaskId, setBlockedByTaskId, evidenceText, setEvidenceText, validationPassed, setValidationPassed, validationNotes, setValidationNotes, completionError, setCompletionError, selectedCompletingAgentId, setSelectedCompletingAgentId, selectedClaimingAgentId, setSelectedClaimingAgentId, isCompletingTask, setIsCompletingTask, isAddingBlocker, setIsAddingBlocker, taskRequiredFiles, setTaskRequiredFiles, taskAcceptanceCriteria, setTaskAcceptanceCriteria, taskDependencies, setTaskDependencies, modalDetailsTab, setModalDetailsTab, timelineEntries, setTimelineEntries, blackboardText, setBlackboardText, inputText, setInputText, inspectorTab, setInspectorTab, coordinationDetails, setCoordinationDetails, newDecisionText, setNewDecisionText, artifacts, setArtifacts, selectedArtifactPath, setSelectedArtifactPath, selectedArtifactContent, setSelectedArtifactContent, modelPriority, setModelPriority, cpuUsage, setCpuUsage, ramUsage, setRamUsage, tps, setTps, selectAgentForEdit, isSpawnModalOpen, setIsSpawnModalOpen, isTaskModalOpen, setIsTaskModalOpen, spawnName, setSpawnName, spawnRole, setSpawnRole, spawnPersona, setSpawnPersona, spawnProvider, setSpawnProvider, spawnModel, setSpawnModel, spawnTemp, setSpawnTemp, spawnMaxTokens, setSpawnMaxTokens, spawnContinuous, setSpawnContinuous, spawnParentAgentId, setSpawnParentAgentId, spawnAllowedTools, setSpawnAllowedTools, taskTitle, setTaskTitle, taskDesc, setTaskDesc, taskOwner, setTaskOwner, taskPriority, setTaskPriority, ollamaUrl, setOllamaUrl, camelidUrl, setCamelidUrl, openaiKey, setOpenaiKey, anthropicKey, setAnthropicKey, blackboardInput, setBlackboardInput, isThinking, setIsThinking, feedEndRef, loadSuggestions, loadTemplates, handleCreateSoftwareTeam, handleCreateCodingSprint, handleLaunchAgent, handleDecompose, handleApproveSubtasks, handleResolveCommandApproval, handleSuggestionAction, loadArtifacts, handleSelectArtifact, loadLocalModels, loadModelCatalog, loadStorageUsage, handleRemoteSearch, handlePreflightCheck, handleDownloadModel, handlePauseDownload, handleCancelDownload, handleImportLocal, handleOpenModelInspect, handleActivateModelScopedSelect, handleRunSmokeLoadingTest, handleDeleteModelSecure, loadBackendStatus, handleCheckBackendHealth, handleRestartBackend, handleStopBackend, handleGetBackendLogs, handleOpenBackendLogs, handleSaveBackendConfig, handleResetBackendRuntime, loadAgents, loadMessages, loadTasks, loadBlackboard, loadCoordinationDetails, handleResolveHandoff, loadProviderConfigs, handleSendMessage, handleSpawnAgent, handleSaveAgentConfig, handleRetireAgent, safeParseJson, recommendAgentForTask, handleCreateTask, handleTransitionStatus, handleClaimCard, handleCompleteCard, handleAddComment, handleAddBlocker, handleToggleChecklistItem, handleDeleteAgent, handleSaveSettings, blockingOverlayStyle, glassCardStyle, overlayTitleStyle, renderBlockingOverlay } = props;

  return (
    <>
(/* Scoped Local Models Package Manager Dashboard */
<div className="models-container" style={{
  flex: 1,
  display: "flex",
  flexDirection: "column",
  height: "100%",
  overflow: "hidden"
}}>
            
            {/* Top Stats Banner */}
            <div style={{
    padding: "16px 24px",
    borderBottom: "1px solid var(--border-color)",
    background: "rgba(0,0,0,0.15)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  }}>
              <div style={{
      display: "flex",
      alignItems: "center",
      gap: "16px"
    }}>
                <span style={{
        fontSize: "1.3rem"
      }}>🧠</span>
                <div>
                  <h2 style={{
          margin: 0,
          fontSize: "0.95rem",
          fontWeight: 700,
          color: "var(--text-main)"
        }}>Local Model Package Manager</h2>
                  <div style={{
          fontSize: "0.72rem",
          color: "var(--text-muted)",
          marginTop: "2px"
        }}>
                    Storage Directory: <span style={{
            fontFamily: "var(--font-mono)",
            color: "var(--accent-primary)"
          }}>{storageUsage?.models_storage_path || "~/.cameleer/models"}</span>
                  </div>
                </div>
              </div>
              
              <div style={{
      display: "flex",
      gap: "20px",
      fontSize: "0.8rem",
      alignItems: "center"
    }}>
                {activeModel && <>
                    <div style={{
          textAlign: "right"
        }}>
                      <div style={{
            color: "var(--text-muted)",
            fontSize: "0.68rem"
          }}>ACTIVE GLOBAL MODEL</div>
                      <div style={{
            color: "var(--accent-glow)",
            fontWeight: 700,
            maxWidth: "200px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap"
          }}>
                        {activeModel}
                      </div>
                    </div>
                    <div style={{
          width: "1px",
          height: "24px",
          background: "var(--border-color)"
        }} />
                  </>}
                <div style={{
        textAlign: "right"
      }}>
                  <div style={{
          color: "var(--text-muted)",
          fontSize: "0.68rem"
        }}>TOTAL ALLOCATED STORAGE</div>
                  <div style={{
          color: "var(--accent-primary)",
          fontWeight: 700
        }}>
                    {storageUsage ? `${(storageUsage.total_allocated_bytes / 1024 / 1024 / 1024).toFixed(2)} GB` : "0.00 GB"}
                  </div>
                </div>
                <div style={{
        width: "1px",
        height: "24px",
        background: "var(--border-color)"
      }} />
                <div style={{
        textAlign: "right"
      }}>
                  <div style={{
          color: "var(--text-muted)",
          fontSize: "0.68rem"
        }}>INSTALLED RUNNABLES</div>
                  <div style={{
          color: "var(--color-working)",
          fontWeight: 700
        }}>
                    {storageUsage?.installed_count || 0} Models
                  </div>
                </div>
              </div>
            </div>

            {/* Sub-Tabs Selector and Navigation */}
            <div style={{
    display: "flex",
    borderBottom: "1px solid var(--border-color)",
    background: "rgba(0,0,0,0.08)",
    padding: "0 12px"
  }}>
              {[{
      id: "recommended",
      label: "🌟 Curated & Recommended",
      desc: "Seeded tested quants"
    }, {
      id: "installed",
      label: "💾 Installed Models",
      desc: "Active local runtimes"
    }, {
      id: "search",
      label: "🔍 HF Remote Search",
      desc: "Hugging Face library"
    }, {
      id: "downloads",
      label: "📥 Downloads Queue",
      desc: "Background processes"
    }, {
      id: "advanced",
      label: "⚙️ Advanced & Local Import",
      desc: "Drag & drop quants"
    }].map(sub => <button key={sub.id} onClick={() => setModelsSubTab(sub.id as any)} style={{
      padding: "12px 18px",
      border: "none",
      background: "transparent",
      color: modelsSubTab === sub.id ? "var(--accent-primary)" : "var(--text-muted)",
      borderBottom: modelsSubTab === sub.id ? "2px solid var(--accent-primary)" : "2px solid transparent",
      fontSize: "0.8rem",
      fontWeight: modelsSubTab === sub.id ? 700 : 500,
      cursor: "pointer",
      transition: "all 0.2s ease"
    }}>
                  {sub.label}
                </button>)}
            </div>

            {/* Sub-Tab Panel Body */}
            <div style={{
    flex: 1,
    overflowY: "auto",
    padding: "24px"
  }}>
              
              {/* Tab 1: Recommended Models */}
              {modelsSubTab === "recommended" && <div style={{
      display: "flex",
      flexDirection: "column",
      gap: "20px"
    }}>
                  <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
        gap: "20px"
      }}>
                    {modelsCatalog.filter(m => m.provider === "curated").map(model => {
          const isInstalled = model.install_status === "installed";
          const isActive = model.active_status;
          return <div key={model.model_id} className="card-glass" style={{
            padding: "24px",
            borderRadius: "16px",
            border: isActive ? "1px solid rgba(0, 242, 254, 0.3)" : "1px solid var(--border-color)",
            background: isActive ? "rgba(0, 242, 254, 0.02)" : "rgba(255,255,255,0.02)",
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            transition: "all 0.3s ease"
          }}>
                          {isActive && <div style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "3px",
              background: "linear-gradient(90deg, #00f2fe, #4facfe)"
            }} />}
                          <div>
                            <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "12px"
              }}>
                              <span style={{
                  fontSize: "0.65rem",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  padding: "3px 8px",
                  borderRadius: "6px",
                  background: model.compatibility_status === "recommended" ? "rgba(16,185,129,0.08)" : "rgba(245,158,11,0.08)",
                  color: model.compatibility_status === "recommended" ? "#10b981" : "#f59e0b",
                  border: model.compatibility_status === "recommended" ? "1px solid rgba(16,185,129,0.2)" : "1px solid rgba(245,158,11,0.2)"
                }}>
                                {model.compatibility_status}
                              </span>
                              <span style={{
                  fontSize: "0.72rem",
                  color: "var(--text-muted)",
                  fontFamily: "var(--font-mono)"
                }}>
                                {model.quantization}
                              </span>
                            </div>

                            <h3 style={{
                margin: "0 0 4px 0",
                fontSize: "1.05rem",
                fontWeight: 700,
                color: "var(--text-main)"
              }}>
                              {model.display_name}
                            </h3>
                            <div style={{
                display: "flex",
                gap: "10px",
                fontSize: "0.75rem",
                color: "var(--text-muted)",
                marginBottom: "14px",
                fontFamily: "var(--font-mono)"
              }}>
                              <span>Size: {(model.file_size_bytes / 1024 / 1024 / 1024).toFixed(2)} GB</span>
                              <span>•</span>
                              <span>Params: {model.parameter_count}</span>
                            </div>
                            <p style={{
                fontSize: "0.8rem",
                color: "var(--text-muted)",
                lineHeight: 1.5,
                marginBottom: "20px"
              }}>
                              {model.license}
                            </p>
                          </div>

                          <div style={{
              borderTop: "1px solid var(--border-color)",
              paddingTop: "16px",
              display: "flex",
              gap: "10px"
            }}>
                            {isInstalled ? <>
                                <button onClick={() => handleOpenModelInspect(model)} className="btn-primary" style={{
                  flex: 1,
                  padding: "8px 12px",
                  fontSize: "0.78rem"
                }}>
                                  🔍 Inspect Structure
                                </button>
                                <button onClick={() => handleActivateModelScopedSelect(model.model_id, "global", "default")} className="action-btn-hover" disabled={isActive} style={{
                  flex: 1,
                  padding: "8px 12px",
                  fontSize: "0.78rem",
                  background: isActive ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.03)",
                  border: isActive ? "1px solid rgba(16,185,129,0.2)" : "1px solid var(--border-color)",
                  color: isActive ? "#10b981" : "#fff",
                  fontWeight: 700,
                  borderRadius: "8px"
                }}>
                                  {isActive ? "✓ Global Active" : "⚙️ Activate"}
                                </button>
                              </> : <button onClick={() => handleDownloadModel(model.model_id)} className="btn-primary" style={{
                width: "100%",
                padding: "10px"
              }}>
                                Install Curated Model 📥
                              </button>}
                          </div>
                        </div>;
        })}
                  </div>
                </div>}

              {/* Tab 2: Installed Models Grid */}
              {modelsSubTab === "installed" && <div style={{
      display: "flex",
      flexDirection: "column",
      gap: "20px"
    }}>
                  <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
        gap: "20px"
      }}>
                    {modelsCatalog.filter(m => m.install_status === "installed").length === 0 ? <div className="card-glass" style={{
          padding: "40px",
          textAlign: "center",
          gridColumn: "1/-1"
        }}>
                        <span style={{
            fontSize: "2rem"
          }}>📂</span>
                        <h4 style={{
            color: "var(--text-main)",
            margin: "12px 0 6px 0"
          }}>No Models Installed Locally Yet</h4>
                        <p style={{
            color: "var(--text-muted)",
            fontSize: "0.8rem",
            maxWidth: "420px",
            margin: "0 auto"
          }}>
                          Choose a vetted GGUF quant under the Curated tab or search Hugging Face to install models.
                        </p>
                      </div> : modelsCatalog.filter(m => m.install_status === "installed").map(model => {
          const isActive = model.active_status;
          return <div key={model.model_id} className="card-glass" style={{
            padding: "24px",
            borderRadius: "16px",
            border: isActive ? "1px solid rgba(0, 242, 254, 0.3)" : "1px solid var(--border-color)",
            background: "rgba(255,255,255,0.02)",
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between"
          }}>
                            {isActive && <div style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "3px",
              background: "linear-gradient(90deg, #00f2fe, #4facfe)"
            }} />}
                            <div>
                              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "12px"
              }}>
                                <span style={{
                  fontSize: "0.65rem",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  padding: "3px 8px",
                  borderRadius: "6px",
                  background: model.runnable_status ? "rgba(0, 242, 254, 0.08)" : "rgba(124, 77, 255, 0.08)",
                  color: model.runnable_status ? "var(--accent-primary)" : "var(--accent-glow)",
                  border: model.runnable_status ? "1px solid rgba(0, 242, 254, 0.15)" : "1px solid rgba(124, 77, 255, 0.15)"
                }}>
                                  {model.runnable_status ? "Runnable" : "Inspectable Only"}
                                </span>
                                <span style={{
                  fontSize: "0.72rem",
                  color: "var(--text-muted)",
                  fontFamily: "var(--font-mono)"
                }}>
                                  {model.quantization}
                                </span>
                              </div>

                              <h3 style={{
                margin: "0 0 4px 0",
                fontSize: "1.05rem",
                fontWeight: 700,
                color: "var(--text-main)"
              }}>
                                {model.display_name}
                              </h3>
                              <div style={{
                fontSize: "0.72rem",
                color: "var(--text-muted)",
                marginBottom: "14px",
                fontFamily: "var(--font-mono)"
              }}>
                                📁 File Size: {(model.file_size_bytes / 1024 / 1024 / 1024).toFixed(2)} GB
                              </div>
                              <div style={{
                fontSize: "0.75rem",
                background: "rgba(0,0,0,0.18)",
                padding: "10px",
                borderRadius: "8px",
                color: "var(--text-muted)",
                fontFamily: "var(--font-mono)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                marginBottom: "20px"
              }}>
                                Path: {model.local_path}
                              </div>
                            </div>

                            <div style={{
              borderTop: "1px solid var(--border-color)",
              paddingTop: "16px",
              display: "flex",
              gap: "10px"
            }}>
                              <button onClick={() => handleOpenModelInspect(model)} className="btn-primary" style={{
                flex: 1,
                padding: "8px 12px",
                fontSize: "0.78rem"
              }}>
                                🔍 Inspect & Validate
                              </button>
                              <button onClick={() => handleActivateModelScopedSelect(model.model_id, "global", "default")} className="action-btn-hover" disabled={isActive || !model.runnable_status} style={{
                flex: 1,
                padding: "8px 12px",
                fontSize: "0.78rem",
                background: isActive ? "rgba(16,185,129,0.1)" : !model.runnable_status ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.03)",
                border: "1px solid var(--border-color)",
                color: isActive ? "#10b981" : !model.runnable_status ? "rgba(255,255,255,0.1)" : "#fff",
                fontWeight: 700,
                borderRadius: "8px",
                cursor: !model.runnable_status ? "not-allowed" : "pointer"
              }}>
                                {isActive ? "✓ Global Active" : "⚙️ Activate"}
                              </button>
                            </div>
                          </div>;
        })}
                  </div>
                </div>}

              {/* Tab 3: Remote HF Search & Preflight */}
              {modelsSubTab === "search" && <div style={{
      display: "flex",
      flexDirection: "column",
      gap: "24px"
    }}>
                  <div style={{
        display: "flex",
        gap: "12px"
      }}>
                    <input type="text" placeholder="Search Hugging Face GGUF repositories (e.g. bartowski/Llama-3.2)..." value={modelsSearchQuery} onChange={e => setModelsSearchQuery(e.target.value)} style={{
          flex: 1,
          background: "rgba(0,0,0,0.25)",
          border: "1px solid var(--border-color)",
          borderRadius: "10px",
          color: "#fff",
          padding: "12px 18px",
          fontSize: "0.85rem"
        }} />
                    <select value={modelsFilterQuant} onChange={e => setModelsFilterQuant(e.target.value)} style={{
          background: "rgba(0,0,0,0.25)",
          border: "1px solid var(--border-color)",
          borderRadius: "10px",
          color: "#fff",
          padding: "0 18px",
          fontSize: "0.85rem"
        }}>
                      <option value="all">All Quants Whitelists</option>
                      <option value="Q8_0">Q8_0 Only</option>
                      <option value="Q4_K_M">Q4_K_M Only</option>
                      <option value="IQ4_NL">IQ4_NL Only</option>
                    </select>
                    <button onClick={handleRemoteSearch} className="btn-primary" style={{
          padding: "0 24px"
        }}>
                      Search Hub 🔍
                    </button>
                  </div>

                  {/* Preflight Inspection Drawer inside Search Panel */}
                  {preflightLoading && <div className="card-glass" style={{
        padding: "20px",
        display: "flex",
        gap: "16px",
        alignItems: "center"
      }}>
                      <div className="loading-spinner-small" style={{
          width: "20px",
          height: "20px"
        }} />
                      <span style={{
          fontSize: "0.85rem",
          color: "var(--accent-primary)"
        }}>Fetching remote range bytes metadata preflight checks...</span>
                    </div>}

                  {preflightReport && <div className="card-glass" style={{
        padding: "24px",
        border: "1px solid var(--border-color)",
        borderRadius: "14px",
        display: "flex",
        flexDirection: "column",
        gap: "16px"
      }}>
                      <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
                        <h4 style={{
            margin: 0,
            fontSize: "0.9rem",
            color: "var(--text-main)",
            fontWeight: 700
          }}>🔍 GGUF Preflight Range Inspection Report</h4>
                        <span style={{
            fontSize: "0.72rem",
            fontWeight: 700,
            padding: "3px 10px",
            borderRadius: "6px",
            background: preflightReport.compatibility_tier === "Recommended" ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
            color: preflightReport.compatibility_tier === "Recommended" ? "#10b981" : "#ef4444"
          }}>
                          Tier: {preflightReport.compatibility_tier}
                        </span>
                      </div>

                      <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
          fontSize: "0.8rem",
          color: "var(--text-muted)"
        }}>
                        <div>• Architecture: <span style={{
              color: "#fff",
              fontWeight: 600
            }}>{preflightReport.architecture}</span></div>
                        <div>• GGUF Version: <span style={{
              color: "#fff",
              fontWeight: 600
            }}>v{preflightReport.gguf_version}</span></div>
                        <div>• Tensors Parsed: <span style={{
              color: "#fff",
              fontWeight: 600
            }}>{preflightReport.tensor_count}</span></div>
                        <div>• Est. RAM overhead: <span style={{
              color: "var(--accent-primary)",
              fontWeight: 600
            }}>{preflightReport.estimated_memory_required}</span></div>
                      </div>

                      {preflightReport.blockers.length > 0 && <div style={{
          background: "rgba(239,68,68,0.08)",
          border: "1px solid rgba(239,68,68,0.25)",
          padding: "12px",
          borderRadius: "8px",
          display: "flex",
          flexDirection: "column",
          gap: "6px"
        }}>
                          <span style={{
            fontSize: "0.75rem",
            fontWeight: 700,
            color: "#f87171"
          }}>⚠️ GGUF Compatibility Blockers:</span>
                          {preflightReport.blockers.map((bl, i) => <div key={i} style={{
            fontSize: "0.72rem",
            color: "#fca5a5"
          }}>• {bl}</div>)}
                        </div>}

                      <div style={{
          display: "flex",
          gap: "12px",
          fontSize: "0.8rem"
        }}>
                        <div style={{
            color: "var(--text-muted)"
          }}>Recommended Action:</div>
                        <div style={{
            fontWeight: 600,
            color: "var(--text-main)"
          }}>{preflightReport.recommended_action}</div>
                      </div>
                    </div>}

                  {/* Remote Results */}
                  <div style={{
        display: "flex",
        flexDirection: "column",
        gap: "12px"
      }}>
                    {remoteModels.length === 0 ? <div className="card-glass" style={{
          padding: "30px",
          textAlign: "center",
          color: "var(--text-muted)",
          fontSize: "0.8rem"
        }}>
                        Enter search strings to find GGUF models on the Hugging Face hub.
                      </div> : remoteModels.map((entry, idx) => {
          const existingModel = modelsCatalog.find(m => m.source_file === entry.filename);
          const isInstalled = existingModel?.install_status === "installed";
          const isDownloading = downloadState.downloading && downloadState.model === entry.filename;
          return <div key={idx} className="card-glass" style={{
            padding: "16px 20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px"
          }}>
                            <div style={{
              minWidth: 0
            }}>
                              <div style={{
                fontSize: "0.7rem",
                color: "var(--text-muted)",
                fontFamily: "var(--font-mono)"
              }}>{entry.repo_id}</div>
                              <h4 style={{
                margin: "4px 0",
                fontSize: "0.9rem",
                color: "var(--text-main)",
                fontWeight: 700,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis"
              }}>
                                {entry.filename}
                              </h4>
                              <div style={{
                fontSize: "0.72rem",
                color: "var(--text-muted)"
              }}>
                                File Size: {(entry.size_bytes / 1024 / 1024 / 1024).toFixed(2)} GB
                              </div>
                            </div>

                            <div style={{
              display: "flex",
              gap: "10px"
            }}>
                              <button onClick={() => handlePreflightCheck(entry)} className="action-btn-hover" style={{
                padding: "8px 14px",
                borderRadius: "8px",
                border: "1px solid var(--border-color)",
                background: "transparent",
                color: "#fff",
                fontSize: "0.78rem",
                cursor: "pointer"
              }}>
                                Preflight Audit 🔍
                              </button>
                              {isInstalled ? <button disabled style={{
                padding: "8px 14px",
                borderRadius: "8px",
                border: "1px solid rgba(16,185,129,0.2)",
                background: "rgba(16,185,129,0.05)",
                color: "#10b981",
                fontSize: "0.78rem",
                fontWeight: 700
              }}>
                                  ✓ Installed
                                </button> : isDownloading ? <button disabled style={{
                padding: "8px 14px",
                borderRadius: "8px",
                border: "1px solid rgba(0, 242, 254, 0.2)",
                background: "rgba(0, 242, 254, 0.05)",
                color: "var(--accent-primary)",
                fontSize: "0.78rem"
              }}>
                                  Downloading {downloadState.progress.toFixed(0)}%
                                </button> : <button onClick={() => handleDownloadModel(existingModel?.model_id || "llama-3.2-3b")} className="btn-primary" style={{
                padding: "8px 14px",
                fontSize: "0.78rem"
              }}>
                                  Install GGUF 📥
                                </button>}
                            </div>
                          </div>;
        })}
                  </div>
                </div>}

              {/* Tab 4: Active Downloads Queue */}
              {modelsSubTab === "downloads" && <div style={{
      display: "flex",
      flexDirection: "column",
      gap: "20px"
    }}>
                  {downloadState.downloading ? <div className="card-glass" style={{
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: "16px"
      }}>
                      <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
                        <div>
                          <h4 style={{
              margin: 0,
              fontSize: "0.95rem",
              fontWeight: 700,
              color: "var(--text-main)"
            }}>Downloading Model Payload</h4>
                          <span style={{
              fontSize: "0.72rem",
              color: "var(--text-muted)",
              fontFamily: "var(--font-mono)"
            }}>
                            Filename: {downloadState.model}
                          </span>
                        </div>
                        <span style={{
            fontSize: "1.2rem",
            fontWeight: 700,
            color: "var(--accent-primary)",
            fontFamily: "var(--font-mono)"
          }}>
                          {downloadState.progress.toFixed(1)}%
                        </span>
                      </div>

                      <div style={{
          height: "10px",
          background: "rgba(255,255,255,0.05)",
          borderRadius: "5px",
          overflow: "hidden",
          position: "relative"
        }}>
                        <div style={{
            height: "100%",
            background: "linear-gradient(90deg, #00f2fe, #4facfe)",
            width: `${downloadState.progress}%`,
            transition: "width 0.2s ease"
          }} />
                      </div>

                      <div style={{
          display: "flex",
          gap: "12px",
          borderTop: "1px solid var(--border-color)",
          paddingTop: "16px",
          marginTop: "8px"
        }}>
                        <button onClick={() => handlePauseDownload(`${downloadState.model}-dl`)} className="action-btn-hover" style={{
            padding: "8px 16px",
            borderRadius: "8px",
            border: "1px solid var(--border-color)",
            background: "transparent",
            color: "#fff",
            fontSize: "0.78rem"
          }}>
                          Pause Download ⏸
                        </button>
                        <button onClick={() => handleCancelDownload(`${downloadState.model}-dl`)} className="action-btn-hover" style={{
            padding: "8px 16px",
            borderRadius: "8px",
            border: "1px solid rgba(239,68,68,0.2)",
            background: "rgba(239,68,68,0.05)",
            color: "#ef4444",
            fontSize: "0.78rem"
          }}>
                          Cancel & Purge 🚫
                        </button>
                      </div>
                    </div> : <div className="card-glass" style={{
        padding: "40px",
        textAlign: "center",
        color: "var(--text-muted)",
        fontSize: "0.8rem"
      }}>
                      No active model downloads running in the background queue.
                    </div>}
                </div>}

              {/* Tab 5: Local GGUF Import */}
              {modelsSubTab === "advanced" && <div style={{
      display: "flex",
      flexDirection: "column",
      gap: "24px"
    }}>
                  
                  {/* File Import Form */}
                  <div className="card-glass" style={{
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: "20px"
      }}>
                    <h3 style={{
          margin: 0,
          fontSize: "0.95rem",
          fontWeight: 700,
          color: "var(--text-main)"
        }}>Import Local GGUF File</h3>
                    <p style={{
          margin: 0,
          fontSize: "0.8rem",
          color: "var(--text-muted)",
          lineHeight: 1.4
        }}>
                      Import a GGUF model already stored on your hard drive. Cameleer will analyze its tensor structure and register it inside your catalog manifest instantly.
                    </p>

                    <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px"
        }}>
                      <label style={{
            fontSize: "0.78rem",
            fontWeight: 600,
            color: "var(--text-main)"
          }}>Absolute GGUF Path:</label>
                      <input type="text" placeholder="e.g. /Users/timtoole/Downloads/model.gguf" value={importPath} onChange={e => setImportPath(e.target.value)} style={{
            background: "rgba(0,0,0,0.25)",
            border: "1px solid var(--border-color)",
            borderRadius: "8px",
            color: "#fff",
            padding: "10px 14px",
            fontSize: "0.82rem"
          }} />
                    </div>

                    <div style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontSize: "0.8rem"
        }}>
                      <input type="checkbox" id="copyCopy" checked={importCopy} onChange={e => setImportCopy(e.target.checked)} />
                      <label htmlFor="copyCopy" style={{
            color: "var(--text-muted)"
          }}>
                        Copy file directly into Cameleer's internal model store (Recommended for path consistency)
                      </label>
                    </div>

                    <button onClick={handleImportLocal} className="btn-primary" style={{
          padding: "12px",
          width: "180px",
          alignSelf: "flex-start"
        }}>
                      Verify & Import Model 📂
                    </button>
                  </div>

                  {/* Settings toggle */}
                  <div className="card-glass" style={{
        padding: "24px"
      }}>
                    <h3 style={{
          margin: "0 0 12px 0",
          fontSize: "0.95rem",
          fontWeight: 700,
          color: "var(--text-main)"
        }}>Developer Options</h3>
                    <div style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          fontSize: "0.8rem"
        }}>
                      <input type="checkbox" id="devMode" checked={developerMode} onChange={e => setDeveloperMode(e.target.checked)} />
                      <label htmlFor="devMode" style={{
            color: "var(--text-muted)",
            fontWeight: 600
          }}>
                        Enable Developer Mod (Permits raw overrides and custom activations of unsupported quants)
                      </label>
                    </div>
                  </div>
                </div>}

            </div>

            {/* Model Inspect Details Drawer Panel Overlay */}
            {selectedModelForInspect && <div style={{
    position: "fixed",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    background: "rgba(0,0,0,0.5)",
    backdropFilter: "blur(4px)",
    zIndex: 999,
    display: "flex",
    justifyContent: "flex-end"
  }}>
                <div style={{
      width: "720px",
      height: "100%",
      background: "var(--bg-glass-heavy)",
      borderLeft: "1px solid var(--border-color)",
      boxShadow: "-10px 0 40px rgba(0,0,0,0.5)",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden"
    }}>
                  
                  {/* Drawer Header */}
                  <div style={{
        padding: "20px 24px",
        borderBottom: "1px solid var(--border-color)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        background: "rgba(0,0,0,0.2)"
      }}>
                    <div>
                      <h3 style={{
            margin: 0,
            fontSize: "1.1rem",
            fontWeight: 700,
            color: "var(--accent-primary)"
          }}>
                        {selectedModelForInspect.display_name}
                      </h3>
                      <div style={{
            fontSize: "0.72rem",
            color: "var(--text-muted)",
            marginTop: "2px"
          }}>
                        ID: {selectedModelForInspect.model_id}
                      </div>
                    </div>
                    <button onClick={() => setSelectedModelForInspect(null)} style={{
          border: "none",
          background: "transparent",
          color: "var(--text-muted)",
          fontSize: "1.4rem",
          cursor: "pointer"
        }}>
                      ×
                    </button>
                  </div>

                  {/* Drawer Tabs Navigation */}
                  <div style={{
        display: "flex",
        borderBottom: "1px solid var(--border-color)",
        background: "rgba(0,0,0,0.05)"
      }}>
                    {[{
          id: "overview",
          label: "📋 Overview"
        }, {
          id: "metadata",
          label: "⚙️ GGUF Metadata"
        }, {
          id: "tensors",
          label: "🧩 Tensor Layout"
        }, {
          id: "compatibility",
          label: "🎯 Compatibility"
        }, {
          id: "smoke",
          label: "⚡ Smoke Test"
        }].map(tab => <button key={tab.id} onClick={() => setActiveModelDetailTab(tab.id as any)} style={{
          flex: 1,
          padding: "12px",
          border: "none",
          background: "transparent",
          color: activeModelDetailTab === tab.id ? "var(--accent-primary)" : "var(--text-muted)",
          borderBottom: activeModelDetailTab === tab.id ? "2px solid var(--accent-primary)" : "2px solid transparent",
          fontSize: "0.78rem",
          fontWeight: activeModelDetailTab === tab.id ? 700 : 500,
          cursor: "pointer"
        }}>
                        {tab.label}
                      </button>)}
                  </div>

                  {/* Drawer Body Scroll */}
                  <div style={{
        flex: 1,
        overflowY: "auto",
        padding: "24px"
      }}>
                    
                    {/* Drawer Tab 1: Overview */}
                    {activeModelDetailTab === "overview" && <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "24px"
        }}>
                        
                        {/* Summary Metrics */}
                        <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "16px"
          }}>
                          <div className="card-glass" style={{
              padding: "16px"
            }}>
                            <div style={{
                fontSize: "0.68rem",
                color: "var(--text-muted)"
              }}>ARCHITECTURE</div>
                            <div style={{
                fontSize: "1.1rem",
                fontWeight: 700,
                color: "#fff",
                marginTop: "4px"
              }}>
                              {selectedModelForInspect.architecture || "unknown"}
                            </div>
                          </div>
                          <div className="card-glass" style={{
              padding: "16px"
            }}>
                            <div style={{
                fontSize: "0.68rem",
                color: "var(--text-muted)"
              }}>QUANTIZATION TYPE</div>
                            <div style={{
                fontSize: "1.1rem",
                fontWeight: 700,
                color: "#fff",
                marginTop: "4px"
              }}>
                              {selectedModelForInspect.quantization || "unknown"}
                            </div>
                          </div>
                        </div>

                        {/* License/Description */}
                        <div className="card-glass" style={{
            padding: "20px"
          }}>
                          <h4 style={{
              margin: "0 0 8px 0",
              fontSize: "0.85rem",
              fontWeight: 700
            }}>Description & Recommendation</h4>
                          <p style={{
              margin: 0,
              fontSize: "0.8rem",
              color: "var(--text-muted)",
              lineHeight: 1.5
            }}>
                            {selectedModelForInspect.license || "No specific usage notes populated for this local model."}
                          </p>
                        </div>

                        {/* Scoped Activation Control */}
                        <div className="card-glass" style={{
            padding: "20px"
          }}>
                          <h4 style={{
              margin: "0 0 12px 0",
              fontSize: "0.85rem",
              fontWeight: 700
            }}>Scoped Activations Gateway</h4>
                          <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px"
            }}>
                            
                            <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                              <div>
                                <div style={{
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: "#fff"
                  }}>Activate Globally</div>
                                <div style={{
                    fontSize: "0.72rem",
                    color: "var(--text-muted)"
                  }}>Sets this model as default for all workspace flows.</div>
                              </div>
                              <button onClick={() => handleActivateModelScopedSelect(selectedModelForInspect.model_id, "global", "default")} className="btn-primary" style={{
                  padding: "8px 16px",
                  fontSize: "0.78rem"
                }}>
                                Activate Global 🚀
                              </button>
                            </div>

                            <div style={{
                width: "100%",
                height: "1px",
                background: "var(--border-color)"
              }} />

                            <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                              <div>
                                <div style={{
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: "#fff"
                  }}>Assign to Lead Coder</div>
                                <div style={{
                    fontSize: "0.72rem",
                    color: "var(--text-muted)"
                  }}>Directly binds this model to your coding agent.</div>
                              </div>
                              <button onClick={() => handleActivateModelScopedSelect(selectedModelForInspect.model_id, "agent", "agent-coder")} className="action-btn-hover" style={{
                  padding: "8px 16px",
                  border: "1px solid var(--border-color)",
                  background: "transparent",
                  color: "#fff",
                  fontSize: "0.78rem"
                }}>
                                Bind Agent-Coder ⚙️
                              </button>
                            </div>

                          </div>
                        </div>

                        {/* Uninstall Secure Button */}
                        <button onClick={() => handleDeleteModelSecure(selectedModelForInspect.model_id)} style={{
            width: "100%",
            padding: "12px",
            borderRadius: "10px",
            background: "rgba(239,68,68,0.06)",
            border: "1px solid rgba(239,68,68,0.2)",
            color: "#f87171",
            fontSize: "0.82rem",
            fontWeight: 700,
            cursor: "pointer",
            transition: "all 0.2s ease"
          }}>
                          Uninstall and Delete Model Payload 🗑️
                        </button>

                      </div>}

                    {/* Drawer Tab 2: GGUF Metadata */}
                    {activeModelDetailTab === "metadata" && <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "16px"
        }}>
                        <input type="text" placeholder="Filter GGUF metadata keys..." value={metadataSearch} onChange={e => setMetadataSearch(e.target.value)} style={{
            background: "rgba(0,0,0,0.2)",
            border: "1px solid var(--border-color)",
            borderRadius: "8px",
            color: "#fff",
            padding: "10px 14px",
            fontSize: "0.8rem"
          }} />

                        <div style={{
            border: "1px solid var(--border-color)",
            borderRadius: "10px",
            overflow: "hidden"
          }}>
                          <table style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.75rem",
              textAlign: "left"
            }}>
                            <thead>
                              <tr style={{
                  background: "rgba(0,0,0,0.3)",
                  borderBottom: "1px solid var(--border-color)"
                }}>
                                <th style={{
                    padding: "12px"
                  }}>Metadata Key Name</th>
                                <th style={{
                    padding: "12px"
                  }}>Parsed Value</th>
                              </tr>
                            </thead>
                            <tbody>
                              {modelDetails?.inspection?.gguf_version ? Object.entries(modelDetails.inspection).filter(([k, _]) => k.toLowerCase().includes(metadataSearch.toLowerCase())).map(([k, v], idx) => <tr key={idx} style={{
                  borderBottom: "1px solid rgba(255,255,255,0.03)"
                }}>
                                      <td style={{
                    padding: "10px 12px",
                    color: "var(--accent-primary)",
                    fontFamily: "var(--font-mono)"
                  }}>{k}</td>
                                      <td style={{
                    padding: "10px 12px",
                    color: "var(--text-main)",
                    wordBreak: "break-all"
                  }}>{String(v)}</td>
                                    </tr>) : <tr>
                                  <td colSpan={2} style={{
                    padding: "20px",
                    textAlign: "center",
                    color: "var(--text-muted)"
                  }}>
                                    No GGUF metadata parsed. Full verification required.
                                  </td>
                                </tr>}
                            </tbody>
                          </table>
                        </div>
                      </div>}

                    {/* Drawer Tab 3: Tensor Layout */}
                    {activeModelDetailTab === "tensors" && <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "16px"
        }}>
                        <input type="text" placeholder="Search tensors in directory layout..." value={tensorSearch} onChange={e => setTensorSearch(e.target.value)} style={{
            background: "rgba(0,0,0,0.2)",
            border: "1px solid var(--border-color)",
            borderRadius: "8px",
            color: "#fff",
            padding: "10px 14px",
            fontSize: "0.8rem"
          }} />

                        <div style={{
            border: "1px solid var(--border-color)",
            borderRadius: "10px",
            overflow: "hidden"
          }}>
                          <table style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.75rem",
              textAlign: "left"
            }}>
                            <thead>
                              <tr style={{
                  background: "rgba(0,0,0,0.3)",
                  borderBottom: "1px solid var(--border-color)"
                }}>
                                <th style={{
                    padding: "12px"
                  }}>Tensor Directory Path</th>
                                <th style={{
                    padding: "12px"
                  }}>Type</th>
                                <th style={{
                    padding: "12px"
                  }}>Shape</th>
                                <th style={{
                    padding: "12px"
                  }}>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {modelDetails?.tensors && modelDetails.tensors.length > 0 ? modelDetails.tensors.filter(t => t.tensor_name.toLowerCase().includes(tensorSearch.toLowerCase())).map((t, idx) => <tr key={idx} style={{
                  borderBottom: "1px solid rgba(255,255,255,0.03)"
                }}>
                                      <td style={{
                    padding: "10px 12px",
                    color: "var(--text-main)",
                    fontFamily: "var(--font-mono)"
                  }}>{t.tensor_name}</td>
                                      <td style={{
                    padding: "10px 12px",
                    color: "var(--accent-secondary)",
                    fontFamily: "var(--font-mono)"
                  }}>{t.tensor_type}</td>
                                      <td style={{
                    padding: "10px 12px",
                    color: "var(--text-muted)"
                  }}>{JSON.stringify(t.shape)}</td>
                                      <td style={{
                    padding: "10px 12px"
                  }}>
                                        <span style={{
                      fontSize: "0.65rem",
                      fontWeight: 700,
                      padding: "2px 6px",
                      borderRadius: "4px",
                      background: t.supported ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
                      color: t.supported ? "#10b981" : "#ef4444"
                    }}>
                                          {t.supported ? "Supported" : "Unsupported"}
                                        </span>
                                      </td>
                                    </tr>) : <tr>
                                  <td colSpan={4} style={{
                    padding: "20px",
                    textAlign: "center",
                    color: "var(--text-muted)"
                  }}>
                                    Tensor map verification pending.
                                  </td>
                                </tr>}
                            </tbody>
                          </table>
                        </div>
                      </div>}

                    {/* Drawer Tab 4: Compatibility Checklist */}
                    {activeModelDetailTab === "compatibility" && <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "20px"
        }}>
                        
                        <h4 style={{
            margin: 0,
            fontSize: "0.9rem",
            color: "var(--text-main)",
            fontWeight: 700
          }}>🔍 System Validation Pipeline Checklist</h4>
                        
                        <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px"
          }}>
                          {[{
              label: "GGUF File Headers Validation",
              pass: modelDetails?.inspection?.gguf_version !== undefined,
              desc: "Magic prefix verification (assert GGUF v2/v3 structures)."
            }, {
              label: "Architecture Model Compatibility",
              pass: selectedModelForInspect.runnable_status,
              desc: "Is architecture whitelisted inside local camelid framework execution loops?"
            }, {
              label: "Quantized Weights Layout Sanity",
              pass: selectedModelForInspect.runnable_status,
              desc: "Verify GGUF contains zero unsupported tensor quant allocations."
            }, {
              label: "Tokenizer Structure Verification",
              pass: modelDetails?.inspection?.tokenizer_model !== undefined,
              desc: "Tokenizer model parameters parsed successfully."
            }].map((check, idx) => <div key={idx} className="card-glass" style={{
              padding: "16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "16px"
            }}>
                              <div>
                                <div style={{
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "#fff"
                }}>{check.label}</div>
                                <div style={{
                  fontSize: "0.72rem",
                  color: "var(--text-muted)",
                  marginTop: "2px"
                }}>{check.desc}</div>
                              </div>
                              <span style={{
                fontSize: "0.72rem",
                fontWeight: 700,
                padding: "4px 10px",
                borderRadius: "6px",
                background: check.pass ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
                color: check.pass ? "#10b981" : "#ef4444"
              }}>
                                {check.pass ? "✓ PASS" : "✗ FAILED"}
                              </span>
                            </div>)}
                        </div>

                      </div>}

                    {/* Drawer Tab 5: Smoke Testing */}
                    {activeModelDetailTab === "smoke" && <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "20px"
        }}>
                        <div className="card-glass" style={{
            padding: "20px"
          }}>
                          <h4 style={{
              margin: "0 0 8px 0",
              fontSize: "0.85rem",
              fontWeight: 700
            }}>Load Performance Benchmark</h4>
                          <p style={{
              margin: 0,
              fontSize: "0.8rem",
              color: "var(--text-muted)",
              lineHeight: 1.4
            }}>
                            Instruct the local Camelid daemon to load the GGUF model binary, allocate GPU Metal caching, compile prompts, and measure generation tokens speed (TPS) on your hard drive.
                          </p>
                          <button onClick={() => handleRunSmokeLoadingTest(selectedModelForInspect.model_id)} disabled={smokeTesting || !selectedModelForInspect.runnable_status} className="btn-primary" style={{
              marginTop: "16px",
              padding: "10px 20px"
            }}>
                            {smokeTesting ? "Smoke Testing Runtimes..." : "Run Smoke Test ⚡"}
                          </button>
                        </div>

                        {smokeTestResult && <div style={{
            background: "#0b0f19",
            border: "1px solid var(--border-color)",
            borderRadius: "10px",
            overflow: "hidden"
          }}>
                            <div style={{
              padding: "10px 16px",
              borderBottom: "1px solid var(--border-color)",
              background: "rgba(255,255,255,0.03)",
              fontSize: "0.75rem",
              fontFamily: "var(--font-mono)",
              color: "var(--accent-primary)"
            }}>
                              Diagnostics Log Output Stream
                            </div>
                            <pre style={{
              margin: 0,
              padding: "16px",
              fontSize: "0.78rem",
              color: "#a5b4fc",
              fontFamily: "var(--font-mono)",
              whiteSpace: "pre-wrap",
              lineHeight: 1.4
            }}>
                              <code>{smokeTestResult.log_output}</code>
                            </pre>
                          </div>}
                      </div>}

                  </div>

                </div>
              </div>}

          </div>)
    </>
  );
}