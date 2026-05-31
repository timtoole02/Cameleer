import React, { useState, useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";

interface TerminalLine {
  stream: "stdout" | "stderr";
  line: string;
}

interface TerminalEvent {
  event_type: string;
  agent_id: string | null;
  task_id: string | null;
  payload: TerminalLine;
}

interface TerminalDrawerProps {
  taskId: string;
}

const TerminalDrawer: React.FC<TerminalDrawerProps> = ({ taskId }) => {
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Listen to terminal_output events
    const unlisten = listen<TerminalEvent>("terminal_output", (event) => {
      const payload = event.payload.payload;
      
      // We could filter by taskId if we wanted to only show logs for this specific task
      if (event.payload.task_id === taskId) {
        setLines((prev) => {
          // Keep maximum of 1000 lines to avoid memory leak
          const newLines = [...prev, payload];
          if (newLines.length > 1000) {
            return newLines.slice(newLines.length - 1000);
          }
          return newLines;
        });
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [taskId]);

  useEffect(() => {
    // Auto scroll to bottom
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines]);

  if (lines.length === 0) {
    return (
      <div style={{ padding: "20px", color: "var(--text-muted)", fontSize: "0.9rem", fontStyle: "italic", textAlign: "center" }}>
        No terminal output yet for this task...
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        backgroundColor: "#1e1e1e",
        color: "#d4d4d4",
        fontFamily: "'SF Mono', 'Fira Code', 'Courier New', monospace",
        fontSize: "0.85rem",
        padding: "16px",
        height: "100%",
        overflowY: "auto",
        borderTop: "1px solid rgba(255,255,255,0.1)",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
      }}
    >
      {lines.map((l, i) => (
        <div 
          key={i} 
          style={{ 
            color: l.stream === "stderr" ? "#f48771" : "#d4d4d4",
            wordBreak: "break-all",
            whiteSpace: "pre-wrap"
          }}
        >
          {l.line}
        </div>
      ))}
    </div>
  );
};

export default TerminalDrawer;
