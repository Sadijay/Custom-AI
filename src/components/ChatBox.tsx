import React, { useState, useEffect, useRef } from 'react';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  isStreaming?: boolean;
}

interface ChatBoxProps {
  onExpressionChange: (expr: import('./Avatar').Expression) => void;
}

const ChatBox: React.FC<ChatBoxProps> = ({ onExpressionChange }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '1', sender: 'bot', text: 'Welcome back, Sasanka 🌸 I remember our conversations.' }
  ]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamingIdRef = useRef<string | null>(null);

  // Auto-scroll to bottom on new content
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Subscribe to AI streaming events once on mount
  useEffect(() => {
    const removeChunkListener = window.electron.onAiChunk((chunk: string) => {
      setMessages(prev => {
        const id = streamingIdRef.current;
        if (!id) return prev;
        return prev.map(msg =>
          msg.id === id
            ? { ...msg, text: msg.text + chunk, isStreaming: true }
            : msg
        );
      });
    });

    const removeEndListener = window.electron.onAiEnd(() => {
      setIsStreaming(false);
      streamingIdRef.current = null;
      // Mark the last bot message as done streaming
      setMessages(prev =>
        prev.map(msg =>
          msg.isStreaming ? { ...msg, isStreaming: false } : msg
        )
      );
      onExpressionChange('happy');
    });

    return () => {
      removeChunkListener();
      removeEndListener();
    };
  }, [onExpressionChange]);

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;

    const userText = input.trim();
    setInput('');

    // Add user message
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: userText,
    };
    setMessages(prev => [...prev, userMsg]);
    setIsStreaming(true);
    onExpressionChange('thinking');

    // Create a placeholder bot message that will be filled by streaming
    const botId = (Date.now() + 1).toString();
    streamingIdRef.current = botId;
    const botMsg: ChatMessage = {
      id: botId,
      sender: 'bot',
      text: '',
      isStreaming: true,
    };
    setMessages(prev => [...prev, botMsg]);

    // Send to backend
    window.electron.sakuraSend(userText);
  };

  const handleClearHistory = () => {
    window.electron.clearHistory();
    setMessages([{ id: Date.now().toString(), sender: 'bot', text: 'Memory cleared. Fresh start 🌸' }]);
  };

  return (
    <>
      <div className="chat-box">
        {messages.map(msg => (
          <div key={msg.id} className={`message ${msg.sender}`}>
            {msg.text}
            {msg.isStreaming && <span className="cursor-blink">▌</span>}
          </div>
        ))}
        {isStreaming && !streamingIdRef.current && (
          <div className="typing-indicator">
            <div className="typing-dot"></div>
            <div className="typing-dot"></div>
            <div className="typing-dot"></div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-container">
        <input
          type="text"
          className="chat-input"
          placeholder={isStreaming ? 'Sakura is thinking...' : 'Ask Sakura...'}
          value={input}
          disabled={isStreaming}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
        />
        <button className="send-btn" onClick={handleSend} disabled={isStreaming}>
          <span style={{ fontWeight: 'bold', fontSize: '18px' }}>&#62;</span>
        </button>
      </div>

      <button className="clear-btn" onClick={handleClearHistory} title="Clear memory">
        🗑 Clear Memory
      </button>
    </>
  );
};

export default ChatBox;
