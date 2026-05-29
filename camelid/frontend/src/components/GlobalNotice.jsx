export default function GlobalNotice({ notice, noticeTone }) {
  if (!notice) return null

  return (
    <div className="notice-slot has-notice" aria-live="polite">
      <div className={`notice-bar ${noticeTone}`}>{notice}</div>
    </div>
  )
}
