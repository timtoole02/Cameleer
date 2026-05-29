import { useEffect } from 'react'

export default function ConversationDeleteDialog({ open, title, detail, busy, onCancel, onConfirm }) {
  useEffect(() => {
    if (!open) return undefined

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !busy) {
        event.preventDefault()
        onCancel()
      }
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [busy, onCancel, open])

  if (!open) return null

  return (
    <div className="dialog-backdrop" onClick={() => !busy && onCancel()}>
      <div
        className="dialog-card delete-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="delete-dialog-copy">
          <h2 id="delete-dialog-title">Delete conversation?</h2>
          <p id="delete-dialog-description">This permanently removes this chat from this device.</p>
          <div className="delete-dialog-title-chip" title={title || 'Untitled chat'}>{title || 'Untitled chat'}</div>
          {detail ? <div className="delete-dialog-detail">{detail}</div> : null}
        </div>

        <div className="dialog-actions">
          <button type="button" className="dialog-action-button" onClick={onCancel} disabled={busy} autoFocus>
            Cancel
          </button>
          <button type="button" className="dialog-action-button dialog-action-button-danger" onClick={onConfirm} disabled={busy}>
            {busy ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}
