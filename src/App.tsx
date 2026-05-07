import React, { useEffect, useState } from "react";
import Avatar, { Expression } from "./components/Avatar";
import ChatBox from "./components/ChatBox";
import "./index.css";

// Give TS typing for the global electron bridge
declare global {
  interface Window {
    electron: {
      // Window controls
      invoke: (channel: string, data?: any) => Promise<any>;
      showWindow: () => void;
      hideWindow: () => void;
      minimizeWindow: () => void;
      quitApp: () => void;
      // AI Streaming API
      sakuraSend: (text: string) => void;
      onAiChunk: (callback: (chunk: string) => void) => () => void;
      onAiEnd: (callback: () => void) => () => void;
      clearHistory: () => void;
    };
  }
}

const App: React.FC = () => {
  const [expression, setExpression] = useState<Expression>('neutral');

  useEffect(() => {
    // Show the window once React is mounted
    setTimeout(() => {
      try {
        if (window.electron) window.electron.showWindow();
      } catch (err) {
        console.error(err);
      }
    }, 300);
  }, []);

  const closeWindow = () => {
    try {
      if (window.electron) window.electron.hideWindow();
    } catch (err) {}
  };

  return (
    <div className="sakura-container">
      <div className="header-drag-region">
        <span>Sakura 🌸</span>
        <div style={{ display: 'flex', gap: '15px' }}>
          <button className="close-btn" style={{ paddingBottom: '5px' }} onClick={() => { if (window.electron) window.electron.minimizeWindow() }}>_</button>
          <button className="close-btn" onClick={closeWindow}>×</button>
        </div>
      </div>
      <Avatar expression={expression} />
      <ChatBox onExpressionChange={setExpression} />
    </div>
  );
}

export default App;
