import React, { useEffect, useState } from 'react';
import { getMemories } from '../api/memory';
import { getBackendStatus } from '../api/runtime';
import { getMissionAuditEvents } from '../api/audit';
import { getAutopilotSettings } from '../api/settings';
import { LoadingSpinner, ErrorBanner, EmptyState } from '../components/common/UIStates';

export const MemoryPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  useEffect(() => { getMemories("ws").finally(() => setLoading(false)); }, []);
  if (loading) return <LoadingSpinner />;
  return <EmptyState title="Memory" description="Memory system is not fully wired yet." />;
};

export const RuntimePage: React.FC = () => {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    getBackendStatus().then(setStatus).catch((e: any) => setError(e.toString())).finally(() => setLoading(false));
  }, []);
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorBanner message={error} />;
  return <div><h3>Runtime Status</h3><pre>{JSON.stringify(status, null, 2)}</pre></div>;
};

export const AuditPage: React.FC = () => {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    getMissionAuditEvents("ws").then(setEvents).catch((e: any) => setError(e.toString())).finally(() => setLoading(false));
  }, []);
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorBanner message={error} />;
  if (events.length === 0) return <EmptyState title="No Audit Logs" description="No actions have been recorded yet." />;
  return <div><h3>Audit Logs</h3><ul>{events.map((e, i) => <li key={i}>{e.action}</li>)}</ul></div>;
};

export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    getAutopilotSettings("ws").then(setSettings).catch((e: any) => setError(e.toString())).finally(() => setLoading(false));
  }, []);
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorBanner message={error} />;
  return <div><h3>Settings</h3><pre>{JSON.stringify(settings, null, 2)}</pre></div>;
};
