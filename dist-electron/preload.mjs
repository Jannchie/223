"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  getModelPath: (modelName) => {
    return `app://models/${modelName}`;
  },
  // 鼠标位置监听
  onMousePosition: (callback) => {
    electron.ipcRenderer.on("mouse-position", (_, position) => callback(position));
  },
  // 移除鼠标位置监听
  removeMousePositionListener: () => {
    electron.ipcRenderer.removeAllListeners("mouse-position");
  }
});
electron.contextBridge.exposeInMainWorld("ipcRenderer", {
  on(...args) {
    const [channel, listener] = args;
    return electron.ipcRenderer.on(channel, (event, ...args2) => listener(event, ...args2));
  },
  off(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.off(channel, ...omit);
  },
  send(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.send(channel, ...omit);
  },
  invoke(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.invoke(channel, ...omit);
  }
  // You can expose other APTs you need here.
  // ...
});
