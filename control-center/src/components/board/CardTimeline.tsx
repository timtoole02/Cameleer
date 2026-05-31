import { useEffect, useState } from "react";
import { api } from "../../services/api";

interface TimelineEntry {
  timestamp: string;
  entry_type: string;
  agent_id: string | null;
  title: string;
  details: any;
}

interface Props {
  cardId: string;
  validationStatus: string | null;
  onRefreshCard?: () => void;
}

export default function CardTimeline({ cardId, validationStatus, onRefreshCard }: Props) {
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Review submission state
  const [verdict, setVerdict] = useState<"passed" | "rejected">("passed");
  const [comments, setComments] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const fetchTimeline = async () => {
    setLoading(true);
    try {
      const res = await api.getCardTimeline({ taskId: cardId });
      setTimeline(res as TimelineEntry[]);
      setError(null);
    } catch (err: any) {
      setError(err?.toString() || "Failed to load timeline");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimeline();
  }, [cardId]);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.submitReviewVerdict({
        cardId,
        reviewerId: "human",
        verdict,
        comments: comments || null,
      });
      setComments("");
      fetchTimeline();
      if (onRefreshCard) onRefreshCard();
    } catch (err: any) {
      alert("Failed to submit review: " + err);
    } finally {
      setSubmitting(false);
    }
  };

  // Helper to format timestamps nicely
  const formatTime = (timeStr: string) => {
    try {
      const date = new Date(timeStr.replace(" ", "T"));
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + 
        " " + date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return timeStr;
    }
  };

  const getEntryBadge = (entry: TimelineEntry) => {
    switch (entry.entry_type) {
      case "event":
        return { icon: "🔄", color: "#30d158", label: "Transition" };
      case "run_step":
        return { icon: "🤖", color: "#0a84ff", label: "Reasoning" };
      case "tool_invocation":
        return { icon: "🛠️", color: "#ffd60a", label: "Tool Call" };
      case "tool_approval":
        return { icon: "🛡️", color: "#ff9f0a", label: "Guard" };
      case "artifact":
        return { icon: "📝", color: "#bf5af2", label: "Artifact" };
      case "receipt":
        return { icon: "🎟️", color: "#30d158", label: "Receipt" };
      case "review":
        return { icon: "👤", color: entry.details?.verdict?.toLowerCase() === "passed" ? "#30d158" : "#ff453a", label: "Verdict" };
      default:
        return { icon: "📌", color: "#8e8e93", label: "System" };
    }
  };

  if (loading && timeline.length === 0) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "var(--space-xl)", color: "var(--text-secondary)" }}>
        <style>{`
          .spinner {
            border: 2px solid rgba(255,255,255,0.1);
            border-top: 2px solid var(--accent-blue);
            border-radius: 50%;
            width: 20px;
            height: 20px;
            animation: spin 0.8s linear infinite;
            margin-right: 10px;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
        <div className="spinner"></div> Loading runtime timeline...
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
      {/* Interactive Review Verdict Panel */}
      {validationStatus !== "passed" && (
        <form onSubmit={handleSubmitReview} style={{
          padding: "var(--space-md)",
          borderRadius: "var(--radius-sm)",
          background: "linear-gradient(135deg, rgba(30, 30, 30, 0.6), rgba(20, 20, 20, 0.8))",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
          backdropFilter: "blur(10px)"
        }}>
          <h4 style={{ margin: "0 0 var(--space-sm) 0", fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", letterSpacing: "0.5px" }}>
            ⚖️ SUBMIT HUMAN REVIEW VERDICT
          </h4>
          
          <div style={{ display: "flex", gap: "var(--space-sm)", marginBottom: "var(--space-sm)" }}>
            <button
              type="button"
              onClick={() => setVerdict("passed")}
              style={{
                flex: 1,
                padding: "8px",
                borderRadius: "var(--radius-xs)",
                border: "1px solid " + (verdict === "passed" ? "#30d158" : "rgba(255,255,255,0.1)"),
                background: verdict === "passed" ? "rgba(48, 209, 88, 0.15)" : "transparent",
                color: verdict === "passed" ? "#30d158" : "var(--text-secondary)",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              ✓ Approve / Pass
            </button>
            <button
              type="button"
              onClick={() => setVerdict("rejected")}
              style={{
                flex: 1,
                padding: "8px",
                borderRadius: "var(--radius-xs)",
                border: "1px solid " + (verdict === "rejected" ? "#ff453a" : "rgba(255,255,255,0.1)"),
                background: verdict === "rejected" ? "rgba(255, 69, 58, 0.15)" : "transparent",
                color: verdict === "rejected" ? "#ff453a" : "var(--text-secondary)",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              ✗ Reject / Fail
            </button>
          </div>

          <textarea
            placeholder="Write constructive review feedback or notes here..."
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            style={{
              width: "100%",
              minHeight: "60px",
              padding: "8px",
              borderRadius: "var(--radius-xs)",
              backgroundColor: "rgba(0,0,0,0.3)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "var(--text-primary)",
              fontSize: "12px",
              lineHeight: 1.4,
              fontFamily: "inherit",
              resize: "vertical",
              marginBottom: "var(--space-sm)",
              boxSizing: "border-box"
            }}
          />

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: "var(--radius-xs)",
              border: "none",
              backgroundColor: verdict === "passed" ? "#30d158" : "#ff453a",
              color: "#000",
              fontWeight: 700,
              fontSize: "13px",
              cursor: submitting ? "not-allowed" : "pointer",
              transition: "all 0.2s",
              boxShadow: "0 2px 10px rgba(0,0,0,0.2)"
            }}
          >
            {submitting ? "Submitting Verdict..." : "Register Review Verdict"}
          </button>
        </form>
      )}

      {/* Timeline List */}
      <div style={{ display: "flex", flexDirection: "column", position: "relative" }}>
        {/* Central connecting line */}
        <div style={{
          position: "absolute",
          top: "16px",
          bottom: "16px",
          left: "17px",
          width: "2px",
          background: "linear-gradient(to bottom, var(--border-default), rgba(255,255,255,0.02))",
          zIndex: 0
        }} />

        {error && (
          <div style={{ color: "var(--danger-red)", fontSize: "13px", padding: "var(--space-md)", textAlign: "center" }}>
            ⚠️ {error}
          </div>
        )}

        {timeline.length === 0 ? (
          <div style={{ padding: "var(--space-xl)", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
            No runtime activities recorded for this card yet.
          </div>
        ) : (
          timeline.map((entry, index) => {
            const badge = getEntryBadge(entry);
            const isExpanded = expandedIndex === index;

            return (
              <div key={index} style={{
                display: "flex",
                gap: "var(--space-md)",
                marginBottom: "var(--space-md)",
                position: "relative",
                zIndex: 1
              }}>
                {/* Circular Icon Marker */}
                <div style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  backgroundColor: "rgba(30, 30, 30, 0.9)",
                  border: `2px solid ${badge.color}`,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  fontSize: "16px",
                  flexShrink: 0,
                  boxShadow: "0 0 10px rgba(0,0,0,0.5)",
                  cursor: "pointer",
                  transition: "transform 0.2s"
                }}
                onClick={() => setExpandedIndex(isExpanded ? null : index)}
                onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.1)"}
                onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1.0)"}
                >
                  {badge.icon}
                </div>

                {/* Event Details Card */}
                <div style={{
                  flex: 1,
                  borderRadius: "var(--radius-xs)",
                  backgroundColor: "rgba(255, 255, 255, 0.02)",
                  border: "1px solid var(--border-default)",
                  padding: "var(--space-sm) var(--space-md)",
                  display: "flex",
                  flexDirection: "column",
                  transition: "all 0.2s"
                }}>
                  <div style={{ display: "flex", justifyContent: "between", alignItems: "flex-start", gap: "var(--space-sm)", flexWrap: "wrap" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)" }}>
                        <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>{entry.title}</span>
                        <span style={{
                          fontSize: "9px",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          backgroundColor: badge.color + "15",
                          color: badge.color
                        }}>
                          {badge.label}
                        </span>
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "2px" }}>
                        {entry.agent_id ? `By: ${entry.agent_id}` : "System trigger"}
                      </div>
                    </div>
                    
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                      {formatTime(entry.timestamp)}
                    </span>
                  </div>

                  {/* Render inline summaries for quick readability */}
                  {entry.entry_type === "event" && entry.details?.old_status && (
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "var(--space-xs)" }}>
                      Moved from <span style={{ textTransform: "capitalize", fontWeight: 500 }}>{entry.details.old_status}</span> to{" "}
                      <span style={{ textTransform: "capitalize", fontWeight: 600, color: "var(--accent-blue)" }}>{entry.details.new_status}</span>
                      {entry.details.reason && <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "2px" }}>Reason: {entry.details.reason}</div>}
                    </div>
                  )}

                  {entry.entry_type === "review" && (
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "var(--space-xs)" }}>
                      Review status set to <span style={{ fontWeight: 600, color: entry.details.verdict === "passed" ? "#30d158" : "#ff453a" }}>{entry.details.verdict}</span>
                      {entry.details.comments && <div style={{ fontStyle: "italic", fontSize: "11px", color: "var(--text-tertiary)", marginTop: "2px" }}>"{entry.details.comments}"</div>}
                    </div>
                  )}

                  {entry.entry_type === "run_step" && (
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "var(--space-xs)", lineHeight: 1.4 }}>
                      {entry.details.content}
                    </div>
                  )}

                  {entry.entry_type === "tool_invocation" && (
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "var(--space-xs)" }}>
                      Status: <span style={{
                        color: entry.details.status === "success" ? "#30d158" : entry.details.status === "error" ? "#ff453a" : "#ff9f0a",
                        fontWeight: 600
                      }}>{entry.details.status}</span>
                      {entry.details.arguments?.command && <div style={{ fontFamily: "monospace", fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>$ {entry.details.arguments.command}</div>}
                      {entry.details.arguments?.path && <div style={{ fontFamily: "monospace", fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>Write file: {entry.details.arguments.path}</div>}
                    </div>
                  )}

                  {/* Expand button for detailed JSON and output payloads */}
                  {(entry.details && Object.keys(entry.details).length > 0) && (
                    <button
                      onClick={() => setExpandedIndex(isExpanded ? null : index)}
                      style={{
                        alignSelf: "flex-end",
                        background: "transparent",
                        border: "none",
                        color: "var(--accent-blue)",
                        fontSize: "11px",
                        cursor: "pointer",
                        marginTop: "var(--space-xs)",
                        padding: 0
                      }}
                    >
                      {isExpanded ? "▲ Collapse details" : "▼ Expand full logs"}
                    </button>
                  )}

                  {/* Expandable JSON/text output viewer */}
                  {isExpanded && (
                    <pre style={{
                      margin: "var(--space-sm) 0 0 0",
                      padding: "var(--space-sm)",
                      backgroundColor: "rgba(0,0,0,0.4)",
                      borderRadius: "4px",
                      fontSize: "11px",
                      color: "var(--text-primary)",
                      fontFamily: "var(--font-mono)",
                      overflowX: "auto",
                      whiteSpace: "pre-wrap",
                      border: "1px solid rgba(255, 255, 255, 0.05)"
                    }}>
                      {JSON.stringify(entry.details, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
