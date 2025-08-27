import { contextBridge, ipcRenderer } from 'electron'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('electronAPI', {
  getModelPath: (modelName: string) => {
    // 使用自定义协议来加载本地文件
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
