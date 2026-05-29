import { capabilityStatusTone, displayCapabilityCopy, displayCapabilityId, formatCapabilityStatus, frontendSupportContractCopy, getCurrentCompatibilityTarget, guardedCapabilityCopy, isGuardedCapabilityStatus } from '../lib/capabilities'
import { formatCompactNumber, formatDate, formatRate } from '../lib/formatters'
import { isRunnableModel } from '../lib/modelState'

function startOfDay(date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function dayKey(date) {
  return startOfDay(date).toISOString().slice(0, 10)
}

function labelDay(date) {
  return new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date)
}

function safeAverage(values) {
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function conversationLabel(conversation) {
  const raw = conversation?.title?.trim()
  return raw && raw.toLowerCase() !== 'new conversation' ? raw : 'Untitled chat'
}

function summarizeGuardedTargets(targets = []) {
  const guarded = targets.filter((target) => isGuardedCapabilityStatus(target.status))
  if (!guarded.length) return 'No planned or guarded compatibility rows advertised.'
  return guarded.slice(0, 3).map((target) => `${target.id}: ${formatCapabilityStatus(target.status)}`).join(' · ')
}

export default function AnalyticsView({ conversations, models, runtime, capabilities }) {
  const now = new Date()
  const sevenDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now)
    date.setDate(now.getDate() - (6 - index))
    return {
      key: dayKey(date),
      label: labelDay(date),
      date,
      prompts: 0,
      replies: 0,
    }
  })
  const dayMap = new Map(sevenDays.map((day) => [day.key, day]))

  const modelStats = new Map()
  let totalMessages = 0
  let totalAssistantReplies = 0
  let totalUserPrompts = 0
  let activeToday = 0
  let latestActivityAt = null

  for (const conversation of conversations) {
    const updatedAt = conversation?.updated_at ? new Date(conversation.updated_at) : null
    if (updatedAt && startOfDay(updatedAt).getTime() === startOfDay(now).getTime()) {
      activeToday += 1
    }
    if (updatedAt && (!latestActivityAt || updatedAt > latestActivityAt)) {
      latestActivityAt = updatedAt
    }

    const modelId = conversation.model_id || 'unknown'
    const base = modelStats.get(modelId) || {
      id: modelId,
      name: models.find((model) => model.id === modelId)?.name || modelId,
      prompts: 0,
      replies: 0,
      conversations: new Set(),
      lastUsedAt: null,
      outRates: [],
      inRates: [],
    }

    base.conversations.add(conversation.id)

    for (const message of conversation.messages || []) {
      totalMessages += 1
      const createdAt = message?.created_at ? new Date(message.created_at) : updatedAt
      if (createdAt && (!base.lastUsedAt || createdAt > base.lastUsedAt)) {
        base.lastUsedAt = createdAt
      }
      if (createdAt && (!latestActivityAt || createdAt > latestActivityAt)) {
        latestActivityAt = createdAt
      }

      const bucket = createdAt ? dayMap.get(dayKey(createdAt)) : null
      if (message.role === 'user') {
        totalUserPrompts += 1
        base.prompts += 1
        if (bucket) bucket.prompts += 1
      }
      if (message.role === 'assistant') {
        totalAssistantReplies += 1
        base.replies += 1
        if (bucket) bucket.replies += 1
        if (message.tokens_out_per_sec !== null && message.tokens_out_per_sec !== undefined) {
          base.outRates.push(Number(message.tokens_out_per_sec))
        }
        if (message.tokens_in_per_sec !== null && message.tokens_in_per_sec !== undefined) {
          base.inRates.push(Number(message.tokens_in_per_sec))
        }
      }
    }

    modelStats.set(modelId, base)
  }

  const modelRows = [...modelStats.values()]
    .map((row) => ({
      ...row,
      conversationCount: row.conversations.size,
      avgOutRate: safeAverage(row.outRates),
      avgInRate: safeAverage(row.inRates),
    }))
    .sort((left, right) => {
      if (right.replies !== left.replies) return right.replies - left.replies
      return (right.prompts + right.replies) - (left.prompts + left.replies)
    })

  const totalTrackedEvents = Math.max(1, totalAssistantReplies + totalUserPrompts)
  const topModels = modelRows.slice(0, 5)
  const chatReadyModels = models.filter(isRunnableModel).length
  const averageReplyRate = safeAverage(modelRows.flatMap((row) => row.outRates))
  const busiestDay = [...sevenDays].sort((left, right) => (right.prompts + right.replies) - (left.prompts + left.replies))[0]
  const recentThreads = [...conversations]
    .sort((left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime())
    .slice(0, 4)
  const supportContract = capabilities?.support_contract
  const supportContractCurrentGate = frontendSupportContractCopy(capabilities)
  const currentTarget = getCurrentCompatibilityTarget(capabilities)
  const compatibilityTargets = capabilities?.model_compatibility || []
  const guardedTargets = compatibilityTargets.filter((target) => isGuardedCapabilityStatus(target.status))
  const guardedFeatures = (capabilities?.api_features || []).filter((feature) => isGuardedCapabilityStatus(feature.status))

  return (
    <section className="view-stack analytics-view view-shell">
      <div className="panel panel-hero analytics-hero">
        <div className="view-hero-copy">
          <p className="panel-kicker">Internal analytics</p>
          <h2>How your local models are actually being used</h2>
          <p className="hero-summary">A calmer internal view of prompts, replies, activity patterns, and which local models are doing the work. Telemetry shows usage, not support: model-family, quantization, and API readiness still come from /api/capabilities and COMPATIBILITY.md.</p>
        </div>
        <div className="analytics-hero-aside">
          <div className={`status-pill ${runtime?.generation_ready ? 'ready' : 'warm'}`}>
            {runtime?.generation_ready ? 'Runtime generation-ready' : runtime?.loaded_now ? 'Runtime loaded, not ready' : 'Runtime needs a generation-ready model'}
          </div>
          <div className="analytics-hero-note">
            <span>Latest activity</span>
            <strong>{latestActivityAt ? formatDate(latestActivityAt.toISOString()) : 'No chat activity yet'}</strong>
          </div>
        </div>
      </div>

      <div className="analytics-stat-grid">
        <div className="analytics-stat-card panel">
          <span>Total conversations</span>
          <strong>{formatCompactNumber(conversations.length)}</strong>
          <small>{activeToday} active today</small>
        </div>
        <div className="analytics-stat-card panel">
          <span>User prompts</span>
          <strong>{formatCompactNumber(totalUserPrompts)}</strong>
          <small>{formatCompactNumber(totalMessages)} total stored messages</small>
        </div>
        <div className="analytics-stat-card panel">
          <span>Assistant replies</span>
          <strong>{formatCompactNumber(totalAssistantReplies)}</strong>
          <small>{averageReplyRate ? `${formatRate(averageReplyRate)} average reply speed` : 'Reply speed will appear after assistant messages land'}</small>
        </div>
        <div className="analytics-stat-card panel">
          <span>Chat-ready models</span>
          <strong>{chatReadyModels}</strong>
          <small>{runtime?.generation_ready ? `${runtime?.active_model_id} loaded + generation-ready` : runtime?.loaded_now ? `${runtime?.active_model_id} loaded, chat blocked` : 'Load a local GGUF to unlock chat'}</small>
        </div>
        <div className="analytics-stat-card panel">
          <span>Support contract</span>
          <strong>{supportContractCurrentGate}</strong>
          <small>{currentTarget ? `${currentTarget.id}: ${formatCapabilityStatus(currentTarget.status)}` : 'No /api/capabilities rows loaded'}</small>
        </div>
      </div>

      <section className="panel panel-section analytics-panel">
        <div className="section-heading">
          <div>
            <p className="panel-kicker">Evidence boundary</p>
            <h2>Usage analytics do not expand model support</h2>
          </div>
          <p className="model-summary">This keeps the analytics view aligned with the same /api/capabilities and COMPATIBILITY.md contract used by Chat, Models, API, and System.</p>
        </div>
        <div className="api-grid api-grid-polished api-capabilities-grid" aria-label="Analytics support contract boundary">
          <div className="api-card">
            <strong>Current validated gate</strong>
            {currentTarget ? (
              <>
                <code>{currentTarget.id}</code>
                <p>{formatCapabilityStatus(currentTarget.status)} · {currentTarget.family} · {currentTarget.quantization}</p>
                <p>{currentTarget.frontend_load_path_verified ? `Frontend load: ${formatCapabilityStatus(currentTarget.frontend_load_path_verified)}` : 'Frontend load evidence is not advertised.'}</p>
              </>
            ) : (
              <p>/api/capabilities is unavailable, so analytics will not infer a supported model target.</p>
            )}
          </div>
          <div className="api-card">
            <strong>Runtime gate</strong>
            <p><b>active_model_id:</b> {runtime?.active_model_id || 'none'}</p>
            <p><b>loaded_now:</b> {runtime?.loaded_now ? 'true' : 'false'}</p>
            <p><b>generation_ready:</b> {runtime?.generation_ready ? 'true' : 'false'}</p>
          </div>
          <div className="api-card wide">
            <strong>Guarded compatibility rows</strong>
            <p>{summarizeGuardedTargets(compatibilityTargets)}</p>
            {guardedTargets.length ? (
              <div className="api-feature-list capability-target-list">
                {guardedTargets.slice(0, 4).map((target) => (
                  <div key={target.id}>
                    <span>{target.id}</span>
                    <strong className={capabilityStatusTone(target.status)}>{formatCapabilityStatus(target.status)} · {target.family} · {target.quantization}</strong>
                    <small>{displayCapabilityCopy(target.next_step || 'Keep this target guarded until evidence lands.')}</small>
                  </div>
                ))}
              </div>
            ) : (
              <p>No guarded model compatibility rows are currently advertised.</p>
            )}
          </div>
          <div className="api-card wide">
            <strong>Unsupported / partial API rows</strong>
            {guardedFeatures.length ? (
              <div className="api-feature-list">
                {guardedFeatures.slice(0, 4).map((feature) => (
                  <div key={feature.id}>
                    <span>{displayCapabilityId(feature.id)}</span>
                    <strong className={capabilityStatusTone(feature.status)}>{formatCapabilityStatus(feature.status)}</strong>
                    <small>{displayCapabilityCopy(guardedCapabilityCopy(feature, 'Analytics-driven shortcuts and UI controls'))}</small>
                  </div>
                ))}
              </div>
            ) : (
              <p>No unsupported or partial API rows advertised.</p>
            )}
          </div>
        </div>
      </section>

      <div className="analytics-grid analytics-grid-primary">
        <section className="panel panel-section analytics-panel">
          <div className="section-heading">
            <div>
              <p className="panel-kicker">Model leaderboard</p>
              <h2>Which models are carrying the workload</h2>
            </div>
            <p className="model-summary">Sorted by assistant replies so you can see real usage, not just what is installed.</p>
          </div>
          <div className="analytics-leaderboard">
            {topModels.length === 0 && <div className="empty-state">No model usage yet. Send a few local chats and this board will fill in.</div>}
            {topModels.map((model) => {
              const share = ((model.prompts + model.replies) / totalTrackedEvents) * 100
              return (
                <article key={model.id} className="analytics-model-row">
                  <div className="analytics-model-row-head">
                    <div>
                      <strong>{model.name}</strong>
                      <span>{model.id}</span>
                    </div>
                    <div className="analytics-model-row-metrics">
                      <span>{model.replies} replies</span>
                      <span>{model.avgOutRate ? `${formatRate(model.avgOutRate)} avg out` : 'No speed data yet'}</span>
                    </div>
                  </div>
                  <div className="analytics-bar-track" aria-hidden="true">
                    <div className="analytics-bar-fill" style={{ width: `${Math.max(8, Math.min(100, share))}%` }} />
                  </div>
                  <div className="analytics-model-row-foot">
                    <small>{model.conversationCount} conversations</small>
                    <small>{model.lastUsedAt ? `Last used ${formatDate(model.lastUsedAt.toISOString())}` : 'No recent activity'}</small>
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <section className="panel panel-section analytics-panel">
          <div className="section-heading">
            <div>
              <p className="panel-kicker">Weekly flow</p>
              <h2>Prompt and reply volume</h2>
            </div>
            <p className="model-summary">A lightweight seven day view so you can spot bursts and quiet periods without a heavy chart library.</p>
          </div>
          <div className="analytics-volume-chart">
            {sevenDays.map((day) => {
              const total = day.prompts + day.replies
              const maxTotal = Math.max(...sevenDays.map((entry) => entry.prompts + entry.replies), 1)
              const height = total === 0 ? 10 : Math.max(18, (total / maxTotal) * 100)
              return (
                <div key={day.key} className="analytics-volume-day">
                  <div className="analytics-volume-bars">
                    <div className="analytics-volume-bar analytics-volume-bar-prompts" style={{ height: `${Math.max(10, (day.prompts / maxTotal) * 100)}%` }} />
                    <div className="analytics-volume-bar analytics-volume-bar-replies" style={{ height: `${height}%` }} />
                  </div>
                  <strong>{day.label}</strong>
                  <span>{total} total</span>
                </div>
              )
            })}
          </div>
          <div className="analytics-inline-stats">
            <div className="history-metric-pill">
              <span>Busiest day</span>
              <strong>{busiestDay ? `${busiestDay.label} · ${busiestDay.prompts + busiestDay.replies} events` : 'No activity yet'}</strong>
            </div>
            <div className="history-metric-pill">
              <span>Reply share</span>
              <strong>{totalTrackedEvents ? `${Math.round((totalAssistantReplies / totalTrackedEvents) * 100)}% assistant` : 'No activity yet'}</strong>
            </div>
          </div>
        </section>
      </div>

      <div className="analytics-grid analytics-grid-secondary">
        <section className="panel panel-section analytics-panel">
          <div className="section-heading">
            <div>
              <p className="panel-kicker">Model details</p>
              <h2>Usage, speed, and recency by model</h2>
            </div>
            <p className="model-summary">This is the deeper internal table for comparing real usage across the local model library.</p>
          </div>
          <div className="analytics-table">
            <div className="analytics-table-head analytics-table-row">
              <span>Model</span>
              <span>Conversations</span>
              <span>Prompts</span>
              <span>Replies</span>
              <span>Avg out</span>
              <span>Last used</span>
            </div>
            {modelRows.length === 0 && <div className="empty-state">No model usage to compare yet.</div>}
            {modelRows.map((model) => (
              <div key={model.id} className="analytics-table-row analytics-table-row-data">
                <strong title={model.id}>{model.name}</strong>
                <span>{model.conversationCount}</span>
                <span>{model.prompts}</span>
                <span>{model.replies}</span>
                <span>{model.avgOutRate ? formatRate(model.avgOutRate) : '—'}</span>
                <span>{model.lastUsedAt ? formatDate(model.lastUsedAt.toISOString()) : '—'}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="panel panel-section analytics-panel">
          <div className="section-heading">
            <div>
              <p className="panel-kicker">Recent threads</p>
              <h2>Where usage has been happening most recently</h2>
            </div>
            <p className="model-summary">Helpful for quickly seeing which chats drove the latest model activity.</p>
          </div>
          <div className="analytics-thread-list">
            {recentThreads.length === 0 && <div className="empty-state">No conversations yet.</div>}
            {recentThreads.map((conversation) => {
              const messageCount = conversation.messages?.length || 0
              const assistantReplies = conversation.messages?.filter((message) => message.role === 'assistant').length || 0
              const modelName = models.find((model) => model.id === conversation.model_id)?.name || conversation.model_id || 'No model recorded'
              return (
                <article key={conversation.id} className="analytics-thread-card">
                  <div>
                    <strong>{conversationLabel(conversation)}</strong>
                    <span>{modelName}</span>
                  </div>
                  <div className="analytics-thread-card-meta">
                    <small>{messageCount} messages</small>
                    <small>{assistantReplies} replies</small>
                    <small>{formatDate(conversation.updated_at)}</small>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      </div>
    </section>
  )
}
