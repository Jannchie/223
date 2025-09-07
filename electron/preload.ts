import { contextBridge, ipcRenderer } from 'electron'

// --------- Expose some API to the Renderer process ---------
let staticServerPort = 0

// 监听服务器端口消息
ipcRenderer.on('static-server-port', (_, port: number) => {
  staticServerPort = port
})

contextBridge.exposeInMainWorld('electronAPI', {
  getModelPath: (modelName: string) => {
    // 如果有服务器端口，使用 HTTP 协议；否则使用自定义协议
    if (staticServerPort > 0) {
      return `http://127.0.0.1:${staticServerPort}/models/${modelName}`
    }
    // 回退到自定义协议（用于开发环境）
    return `app://models/${modelName}`
  },

  // 鼠标位置监听
  onMousePosition: (callback: (position: { x: number, y: number }) => void) => {
    ipcRenderer.on('mouse-position', (_, position) => callback(position))
  },

  // 移除鼠标位置监听
  removeMousePositionListener: () => {
    ipcRenderer.removeAllListeners('mouse-position')
  },

  // 控制鼠标事件穿透
  setIgnoreMouseEvents: (options: { ignore: boolean, forward?: boolean }) => {
    ipcRenderer.send('set-ignore-mouse-events', options)
  },

  // 监听窗口鼠标进入事件
  onMouseEnterWindow: (callback: () => void) => {
    ipcRenderer.on('mouse-enter-window', callback)
  },

  // 截图相关 API
  takeScreenshot: () => ipcRenderer.invoke('take-screenshot'),

  toggleScreenshotRoast: (enabled: boolean) => ipcRenderer.invoke('toggle-screenshot-roast', enabled),

  setScreenshotInterval: (intervalMinutes: number) => ipcRenderer.invoke('set-screenshot-interval', intervalMinutes),

  getScreenshotStatus: () => ipcRenderer.invoke('get-screenshot-status'),

  onScreenshotCaptured: (callback: (screenshot: string) => void) => {
    ipcRenderer.on('screenshot-captured', (_, screenshot) => callback(screenshot))
  },

  onHotkeyScreenshotRoast: (callback: (screenshot: string) => void) => {
    ipcRenderer.on('hotkey-screenshot-roast', (_, screenshot) => callback(screenshot))
  },

  removeScreenshotListeners: () => {
    ipcRenderer.removeAllListeners('screenshot-captured')
    ipcRenderer.removeAllListeners('hotkey-screenshot-roast')
  },

  // 语音识别快捷键事件
  onHotkeyVoiceRecognition: (callback: () => void) => {
    ipcRenderer.on('hotkey-voice-recognition', callback)
  },

  removeVoiceRecognitionListener: () => {
    ipcRenderer.removeAllListeners('hotkey-voice-recognition')
  },

  // 录制窗口相关 API
  openRecordingWindow: () => ipcRenderer.invoke('open-recording-window'),

  closeRecordingWindow: () => ipcRenderer.invoke('close-recording-window'),

  getRecordingWindowStatus: () => ipcRenderer.invoke('get-recording-window-status'),

  onSetRecordingMode: (callback: (isRecording: boolean) => void) => {
    ipcRenderer.on('set-recording-mode', (_, isRecording) => callback(isRecording))
  },
})

contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },

  // You can expose other APTs you need here.
  // ...
})
