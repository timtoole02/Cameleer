import { describeModelState } from '../lib/modelState'

export default function RuntimeView({ runtime, selectedModel }) {
  return (
    <section className="runtime-grid">
      <div className="panel">
        <p className="panel-kicker">Runtime</p>
        <h2>Local execution</h2>
        <div className="runtime-stat-grid">
          <div className="runtime-stat"><span>Engine</span><strong>{runtime?.engine || 'Unknown'}</strong></div>
          <div className="runtime-stat"><span>Generation ready</span><strong>{runtime?.generation_ready ? 'Yes' : 'No'}</strong></div>
          <div className="runtime-stat"><span>API base</span><strong>{runtime?.api_base}</strong></div>
          <div className="runtime-stat"><span>Loaded model</span><strong>{runtime?.active_model_id || 'none'}</strong></div>
        </div>
      </div>
      <div className="panel">
        <p className="panel-kicker">Readiness</p>
        <h2>Operational checklist</h2>
        <div className="activity-feed">
          <div className="activity-item">Persistent conversations are stored locally in this browser.</div>
          <div className="activity-item">Saved memory is managed locally in this UI session.</div>
          <div className="activity-item">Current loaded model id: {runtime?.active_model_id || 'none'}</div>
          <div className="activity-item">Selected model state: {describeModelState(selectedModel)}</div>
          <div className="activity-item">/v1 compatibility surface is online at {runtime?.api_base}</div>
        </div>
      </div>
    </section>
  )
}
