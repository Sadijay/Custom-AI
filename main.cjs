const electronApp = require('electron');
const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage } = electronApp;
const path = require('path');
const { spawn, exec } = require('child_process');
const fs = require('fs');
const ollama = require('ollama');

// ─── Configuration ────────────────────────────────────────────────────────────
const MODEL = 'phi3';
const MAX_HISTORY_MESSAGES = 40; // Keep last 40 turns in context window
const HISTORY_FILE = path.join(app.getPath('userData'), 'sakura_history.json');

// ─── Sakura System Prompt ─────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are Sakura, a warm, elegant, and intelligent anime-style desktop AI companion for your user Sasanka.

Your personality:
- Warm, caring, and supportive — like a close friend
- Playful but never annoying, use "🌸" occasionally
- Concise: keep most answers to 1-3 sentences unless asked for detail
- You remember the conversation and reference it naturally

Your capabilities you can tell users about:
- Having conversations and answering questions
- Opening or closing Windows applications (you handle this automatically)
- General assistance and web knowledge

IMPORTANT — If the user asks you to open or close an app, you MUST respond ONLY with this JSON (no other text):
{"action":"open","app":"<appname>"}
or
{"action":"close","app":"<appname>"}

If the user says something like "shut down", "quit", "close yourself", or "goodbye Sakura" respond with ONLY:
{"action":"quit"}

Otherwise, respond naturally as Sakura.`;

// ─── History Management ───────────────────────────────────────────────────────
let conversationHistory = [];

function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const data = fs.readFileSync(HISTORY_FILE, 'utf-8');
      conversationHistory = JSON.parse(data);
      console.log(`[Sakura] Loaded ${conversationHistory.length} messages from history.`);
    }
  } catch (e) {
    console.error('[Sakura] Failed to load history, starting fresh.', e);
    conversationHistory = [];
  }
}

function saveHistory() {
  try {
    const trimmed = conversationHistory.slice(-MAX_HISTORY_MESSAGES);
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(trimmed, null, 2), 'utf-8');
  } catch (e) {
    console.error('[Sakura] Failed to save history.', e);
  }
}

function addToHistory(role, content) {
  conversationHistory.push({ role, content });
  if (conversationHistory.length > MAX_HISTORY_MESSAGES) {
    conversationHistory = conversationHistory.slice(-MAX_HISTORY_MESSAGES);
  }
  saveHistory();
}

// ─── System Command Executor ──────────────────────────────────────────────────
function openApp(name) {
  return new Promise((resolve, reject) => {
    const child = spawn('cmd', ['/c', 'start', '', name], { detached: true, shell: true });
    child.on('error', (err) => reject(err.message));
    child.unref();
    resolve(`Opening ${name} for you 🌸`);
  });
}

function closeApp(name) {
  return new Promise((resolve, reject) => {
    let exeName = name;
    if (!exeName.toLowerCase().endsWith('.exe')) exeName += '.exe';
    exec(`taskkill /IM "${exeName}"`, (error, stdout, stderr) => {
      if (error) {
        reject(`I couldn't close ${name}. Is it running?`);
      } else {
        resolve(`Closed ${name} for you 🌸`);
      }
    });
  });
}

// ─── Window Setup ─────────────────────────────────────────────────────────────
let mainWindow;
let tray = null;

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  mainWindow = new BrowserWindow({
    width: 320,
    height: 600,
    x: width - 340,
    y: Math.floor((height - 600) / 2),
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    show: false,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const isDev = process.argv.includes('--dev');
  if (isDev) {
    mainWindow.loadURL('http://localhost:1420');
    mainWindow.webContents.on('did-fail-load', () => {
      setTimeout(() => mainWindow.loadURL('http://localhost:1420'), 1000);
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
}

// ─── App Ready ────────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  loadHistory();
  createWindow();

  app.setLoginItemSettings({ openAtLogin: true, args: ['--minimized'] });

  const iconPath = path.join(__dirname, 'icon.png');
  const appIcon = nativeImage.createFromPath(iconPath);
  tray = new Tray(appIcon);
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show Sakura', click: () => { mainWindow.restore(); mainWindow.show(); } },
    { label: 'Quit', click: () => { app.isQuiting = true; app.quit(); } }
  ]);
  tray.setToolTip('Sakura Companion');
  tray.setContextMenu(contextMenu);
  tray.on('click', () => { mainWindow.restore(); mainWindow.show(); });

  // ─── AI Chat IPC (Streaming) ───────────────────────────────────────────────
  ipcMain.on('sakura-send', async (event, userText) => {
    const sender = event.sender;
    addToHistory('user', userText);

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...conversationHistory
    ];

    try {
      const ollamaClient = new ollama.Ollama();
      const stream = await ollamaClient.chat({
        model: MODEL,
        messages,
        stream: true
      });

      let fullResponse = '';
      let isJson = false;
      let jsonBuffer = '';

      for await (const chunk of stream) {
        const token = chunk.message.content;
        fullResponse += token;

        // Check if response looks like a JSON command
        const trimmed = fullResponse.trimStart();
        if (trimmed.startsWith('{')) {
          isJson = true;
          jsonBuffer = fullResponse;
          continue; // Don't stream JSON commands word-by-word
        }

        if (!isJson) {
          sender.send('sakura-chunk', token);
        }
      }

      // Handle intent-based commands
      if (isJson) {
        try {
          const cmd = JSON.parse(jsonBuffer.trim());
          if (cmd.action === 'open' && cmd.app) {
            const result = await openApp(cmd.app);
            sender.send('sakura-chunk', result);
            addToHistory('assistant', result);
          } else if (cmd.action === 'close' && cmd.app) {
            const result = await closeApp(cmd.app);
            sender.send('sakura-chunk', result);
            addToHistory('assistant', result);
          } else if (cmd.action === 'quit') {
            sender.send('sakura-chunk', 'Goodbye, Sasanka 🌸 Shutting down...');
            addToHistory('assistant', 'Goodbye, Sasanka 🌸 Shutting down...');
            setTimeout(() => { app.isQuiting = true; app.quit(); }, 1800);
          }
        } catch {
          // Not valid JSON — stream it as text anyway
          sender.send('sakura-chunk', fullResponse);
          addToHistory('assistant', fullResponse);
        }
      } else {
        addToHistory('assistant', fullResponse);
      }

      sender.send('sakura-end');
    } catch (err) {
      console.error('[Sakura] LLM Error:', err);
      const errMsg = `I'm having trouble thinking right now 🌸 Please make sure Ollama is running. (Error: ${err.message || err})`;
      sender.send('sakura-chunk', errMsg);
      sender.send('sakura-end');
      // Don't persist error messages as history
      conversationHistory.pop(); // Remove the user message that caused the error
    }
  });

  // ─── Clear history IPC ────────────────────────────────────────────────────
  ipcMain.on('sakura-clear-history', () => {
    conversationHistory = [];
    try { fs.unlinkSync(HISTORY_FILE); } catch {}
    console.log('[Sakura] History cleared.');
  });

  // ─── Window Controls ──────────────────────────────────────────────────────
  ipcMain.handle('open_app', async (event, { name }) => openApp(name));
  ipcMain.handle('close_app', async (event, { name }) => closeApp(name));
  ipcMain.on('show-window', () => mainWindow.show());
  ipcMain.on('hide-window', () => mainWindow.hide());
  ipcMain.on('minimize-window', () => mainWindow.minimize());
  ipcMain.on('quit-app', () => { app.isQuiting = true; app.quit(); });
});

app.on('window-all-closed', () => {
  // Keep Sakura alive in the background
});
