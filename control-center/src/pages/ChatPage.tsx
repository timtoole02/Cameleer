import React, { useEffect, useState } from 'react';
import { getMessages } from '../api/chat';
import { Message } from '../types';
import { LoadingSpinner, ErrorBanner, EmptyState } from '../components/common/UIStates';

export const ChatPage: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMessages("default-session")
      .then(setMessages)
      .catch((e: any) => setError(e.toString()))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorBanner message={error} />;
  
  return (
    <div>
      <h3>Chat Workspace</h3>
      {messages.length === 0 ? (
        <EmptyState title="No Messages" description="Start the conversation." />
      ) : (
        <ul>
          {messages.map((m, i) => <li key={i}><strong>{m.role}:</strong> {m.content}</li>)}
        </ul>
      )}
    </div>
  );
};
