import { useEffect, useMemo, useRef, useState } from 'react'
import AppSidebar from './components/AppSidebar'
import GlobalNotice from './components/GlobalNotice'
import TopBar from './components/TopBar'
import ConversationDeleteDialog from './components/ConversationDeleteDialog'
import { formatPreview, formatSidebarDate } from './lib/formatters'
import { useDashboardData } from './hooks/useDashboardData'
import { useNotice } from './hooks/useNotice'
import { useTheme } from './hooks/useTheme'
import ChatWorkspace from './views/ChatWorkspace'
import AnalyticsView from './views/AnalyticsView'
import HistoryView from './views/HistoryView'
import MemoryView from './views/MemoryView'
import ModelsView from './views/ModelsView'
import ApiView from './views/ApiView'
import SystemView from './views/SystemView'

const SIDEBAR_MIN_WIDTH = 240
const SIDEBAR_MAX_WIDTH = 420
const SIDEBAR_DEFAULT_WIDTH = 284
const SIDEBAR_COLLAPSED_WIDTH = 48
const DEMO_UI = import.meta.env?.VITE_CAMELID_DEMO_UI === 'true'

const clampSidebarWidth = (value) => Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, value))

function App() {
  const { notice, noticeTone, showNotice, clearNotice } = useNotice()
  useTheme()
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window === 'undefined') return SIDEBAR_DEFAULT_WIDTH
    const saved = Number.parseInt(window.localStorage.getItem('camelid.sidebarWidth') || '', 10)
    return Number.isFinite(saved) ? clampSidebarWidth(saved) : SIDEBAR_DEFAULT_WIDTH
  })
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (DEMO_UI) return true
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem('camelid.sidebarCollapsed') === 'true'
  })
  const [sidebarDragging, setSidebarDragging] = useState(false)
  const [pendingDeleteConversationId, setPendingDeleteConversationId] = useState(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const dragStateRef = useRef({ startX: 0, startWidth: SIDEBAR_DEFAULT_WIDTH })
  const {
    dashboard,
    tab,
    setTab,
    selectedConversationId,
    setSelectedConversationId,
    selectedModelId,
    setSelectedModelId,
    search,
    setSearch,
    memorySearch,
    setMemorySearch,
    composer,
    setComposer,
    newChatTitle,
    setNewChatTitle,
    sending,
    loadingModelId,
    registerForm,
    setRegisterForm,
    externalForm,
    setExternalForm,
    conversations,
    memories,
    filteredConversations,
    models,
    runtime,
    selectedConversation,
    selectedModel,
    selectedModelRunnable,
    latestAssistantMessage,
    pendingConversation,
    createConversation,
    showNewChatLanding,
    sendMessage,
    saveToMemory,
    createMemory,
    updateMemory,
    deleteMemory,
    renameConversation,
    deleteConversation,
    installModel,
    installCatalogModel,
    cancelModelDownload,
    activateModel,
    unloadCurrentModel,
    registerModel,
    connectExternalModel,
    loadDashboard,
  } = useDashboardData({ showNotice, clearNotice })

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem('camelid.sidebarWidth', String(sidebarWidth))
  }, [sidebarWidth])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem('camelid.sidebarCollapsed', String(sidebarCollapsed))
  }, [sidebarCollapsed])

  useEffect(() => {
    if (!sidebarDragging) return undefined

    const handlePointerMove = (event) => {
      const nextWidth = clampSidebarWidth(dragStateRef.current.startWidth + (event.clientX - dragStateRef.current.startX))
      setSidebarWidth(nextWidth)
    }

    const handlePointerUp = () => setSidebarDragging(false)

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [sidebarDragging])

  const sidebarShellStyle = useMemo(() => ({
    '--sidebar-current-width': sidebarCollapsed ? '0px' : `${sidebarWidth}px`,
    '--sidebar-handle-width': sidebarCollapsed ? '0px' : '12px',
    '--sidebar-overlay-width': sidebarCollapsed ? `${SIDEBAR_COLLAPSED_WIDTH}px` : '0px',
  }), [sidebarCollapsed, sidebarWidth])

  const pendingDeleteConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === pendingDeleteConversationId) || null,
    [conversations, pendingDeleteConversationId],
  )

  const selectedConversationPreview = useMemo(() => {
    const latestMessage = [...(selectedConversation?.messages || [])].reverse().find((message) => typeof message?.content === 'string' && message.content.trim() && !message.content.startsWith('Conversation created.'))
    return latestMessage?.content || ''
  }, [selectedConversation])

  const pendingDeleteMessagePreview = useMemo(() => {
    if (!pendingDeleteConversation) return ''
    const latestMessage = [...(pendingDeleteConversation.messages || [])].reverse().find((message) => typeof message?.content === 'string' && message.content.trim())
    return formatPreview(latestMessage?.content, 64)
  }, [pendingDeleteConversation])

  const pendingDeleteTitle = useMemo(() => {
    if (!pendingDeleteConversation) return 'Untitled chat'
    const trimmed = pendingDeleteConversation.title?.trim()
    if (trimmed && trimmed.toLowerCase() !== 'new conversation') return trimmed
    return `Untitled chat · ${formatSidebarDate(pendingDeleteConversation.updated_at) || 'New chat'}`
  }, [pendingDeleteConversation])

  const requestDeleteConversation = (id) => {
    setPendingDeleteConversationId(id)
    setDeleteBusy(false)
  }

  const handleDeleteCancel = () => {
    if (deleteBusy) return
    setPendingDeleteConversationId(null)
  }

  const handleDeleteConfirm = async () => {
    if (!pendingDeleteConversationId || deleteBusy) return

    setDeleteBusy(true)
    const deleted = await deleteConversation(pendingDeleteConversationId)
    if (deleted) {
      setPendingDeleteConversationId(null)
    }
    setDeleteBusy(false)
  }

  const handleSidebarToggle = () => setSidebarCollapsed((current) => !current)

  const handleSidebarResizeStart = (event) => {
    dragStateRef.current = { startX: event.clientX, startWidth: sidebarWidth }
    setSidebarCollapsed(false)
    setSidebarDragging(true)
  }

  const handleSidebarResizeKeyDown = (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      setSidebarCollapsed(false)
      setSidebarWidth((current) => clampSidebarWidth(current - 20))
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      setSidebarCollapsed(false)
      setSidebarWidth((current) => clampSidebarWidth(current + 20))
    }
    if (event.key === 'Home') {
      event.preventDefault()
      setSidebarCollapsed(false)
      setSidebarWidth(SIDEBAR_MIN_WIDTH)
    }
    if (event.key === 'End') {
      event.preventDefault()
      setSidebarCollapsed(false)
      setSidebarWidth(SIDEBAR_MAX_WIDTH)
    }
  }

  if (!dashboard) {
    return (
      <div className="loading-shell">
        <div className="loading-shell-stack">
          <GlobalNotice notice={notice} noticeTone={noticeTone} />
          <div>Loading Camelid…</div>
        </div>
      </div>
    )
  }

  return (
    <div className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${sidebarDragging ? 'sidebar-dragging' : ''} ${DEMO_UI ? 'demo-ui' : ''}`} style={sidebarShellStyle}>
      {!DEMO_UI && (
        <AppSidebar
          collapsed={sidebarCollapsed}
          dragging={sidebarDragging}
          onResizeStart={handleSidebarResizeStart}
          onResizeKeyDown={handleSidebarResizeKeyDown}
          onToggleCollapsed={handleSidebarToggle}
          width={sidebarWidth}
          newChatTitle={newChatTitle}
          setNewChatTitle={setNewChatTitle}
          createConversation={createConversation}
          showNewChatLanding={showNewChatLanding}
          search={search}
          setSearch={setSearch}
          tab={tab}
          setTab={setTab}
          filteredConversations={filteredConversations}
          selectedConversationId={selectedConversation?.id || null}
          setSelectedConversationId={setSelectedConversationId}
          deleteConversation={requestDeleteConversation}
          renameConversation={renameConversation}
        />
      )}

      <main className={`main-pane ${tab === 'chat' ? 'main-pane-chat' : ''}`}>
        <TopBar
          tab={tab}
          setTab={setTab}
          selectedConversationTitle={selectedConversation?.title || ''}
          selectedConversationUpdatedAt={selectedConversation?.updated_at || ''}
          selectedConversationPreview={selectedConversationPreview}
          runtime={runtime}
          capabilities={dashboard?.capabilities}
          selectedModelId={selectedModelId}
          setSelectedModelId={setSelectedModelId}
          models={models}
          demoMode={DEMO_UI}
        />

        <GlobalNotice notice={notice} noticeTone={noticeTone} />

        {tab === 'chat' && (
          <ChatWorkspace
            selectedConversation={selectedConversation}
            selectedModel={selectedModel}
            selectedModelId={selectedModelId}
            setSelectedModelId={setSelectedModelId}
            models={models}
            runtime={runtime}
            capabilities={dashboard?.capabilities}
            latestAssistantMessage={latestAssistantMessage}
            pendingConversation={pendingConversation}
            composer={composer}
            setComposer={setComposer}
            saveToMemory={saveToMemory}
            sendMessage={sendMessage}
            sending={sending}
            selectedModelRunnable={selectedModelRunnable}
            setTab={setTab}
            demoMode={DEMO_UI}
          />
        )}

        {tab === 'analytics' && <AnalyticsView conversations={conversations} models={models} runtime={runtime} capabilities={dashboard?.capabilities} />}

        {tab === 'history' && (
          <HistoryView
            filteredConversations={filteredConversations}
            setSelectedConversationId={setSelectedConversationId}
            setTab={setTab}
            deleteConversation={requestDeleteConversation}
          />
        )}

        {tab === 'memory' && (
          <MemoryView
            memories={memories}
            memorySearch={memorySearch}
            setMemorySearch={setMemorySearch}
            selectedConversation={selectedConversation}
            latestAssistantMessage={latestAssistantMessage}
            saveToMemory={saveToMemory}
            createMemory={createMemory}
            updateMemory={updateMemory}
            deleteMemory={deleteMemory}
            setTab={setTab}
          />
        )}

        {tab === 'library' && (
          <ModelsView
            runtime={runtime}
            capabilities={dashboard?.capabilities}
            refreshDashboard={loadDashboard}
            registerForm={registerForm}
            setRegisterForm={setRegisterForm}
            externalForm={externalForm}
            setExternalForm={setExternalForm}
            registerModel={registerModel}
            connectExternalModel={connectExternalModel}
            models={models}
            selectedModelId={selectedModelId}
            setSelectedModelId={setSelectedModelId}
            loadingModelId={loadingModelId}
            activateModel={activateModel}
            unloadCurrentModel={unloadCurrentModel}
            installModel={installModel}
            installCatalogModel={installCatalogModel}
            cancelModelDownload={cancelModelDownload}
          />
        )}

        {tab === 'api' && <ApiView runtime={runtime} selectedModel={selectedModel} capabilities={dashboard?.capabilities} />}

        {tab === 'system' && <SystemView runtime={runtime} selectedModel={selectedModel} capabilities={dashboard?.capabilities} />}
      </main>

      <ConversationDeleteDialog
        open={Boolean(pendingDeleteConversation)}
        title={pendingDeleteTitle}
        detail={pendingDeleteMessagePreview}
        busy={deleteBusy}
        onCancel={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  )
}

export default App
