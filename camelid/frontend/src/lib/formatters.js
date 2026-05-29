export function formatRate(value) {
  if (value === null || value === undefined) return '—'
  return `${Number(value).toFixed(1)} tok/s`
}

export function formatDate(value) {
  if (!value) return ''
  return new Date(value).toLocaleString()
}

export function formatSidebarDate(value) {
  if (!value) return ''
  const date = new Date(value)
  const now = new Date()
  const sameDay = date.toDateString() === now.toDateString()
  if (sameDay) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }
  return date.toLocaleDateString([], { month: 'numeric', day: 'numeric' })
}

export function formatHistoryDate(value) {
  if (!value) return ''
  const date = new Date(value)
  const now = new Date()
  const sameDay = date.toDateString() === now.toDateString()
  if (sameDay) {
    return `Today, ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export function formatBytes(value) {
  if (value === null || value === undefined) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let size = Number(value)
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024
    unit += 1
  }
  return `${size.toFixed(size >= 100 || unit === 0 ? 0 : 1)} ${units[unit]}`
}

export function formatCompactNumber(value) {
  if (value === null || value === undefined) return '0'
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value))
}

export function formatPreview(value, maxLength = 120) {
  if (!value) return 'No messages yet'
  const normalized = String(value).replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength - 1)}…`
}

export function clampText(value, maxLength = 72) {
  if (!value) return ''
  const normalized = String(value).replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength - 1)}…`
}
