const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  // ─── Window Controls ──────────────────────────────────────────────────────
  invoke: (channel, data) => ipcRenderer.invoke(channel, data),
  showWindow: () => ipcRenderer.send('show-window'),
  hideWindow: () => ipcRenderer.send('hide-window'),
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  quitApp: () => ipcRenderer.send('quit-app'),

  // ─── AI Streaming API ─────────────────────────────────────────────────────
  // Send a user message to the Sakura AI backend
  sakuraSend: (text) => ipcRenderer.send('sakura-send', text),

  // Register a callback for each streamed word/token
  onAiChunk: (callback) => {
    const handler = (_event, chunk) => callback(chunk);
    ipcRenderer.on('sakura-chunk', handler);
    // Return a cleanup function so React can unsubscribe on unmount
    return () => ipcRenderer.removeListener('sakura-chunk', handler);
  },

  // Register a callback for when the AI finishes responding
  onAiEnd: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('sakura-end', handler);
    return () => ipcRenderer.removeListener('sakura-end', handler);
  },

  // Clear all persistent chat history
  clearHistory: () => ipcRenderer.send('sakura-clear-history'),
});
