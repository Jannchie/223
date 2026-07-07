/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    /**
     * The built directory structure
     *
     * ```tree
     * ├─┬─┬ dist
     * │ │ └── index.html
     * │ │
     * │ ├─┬ dist-electron
     * │ │ ├── main.js
     * │ │ └── preload.js
     * │
     * ```
     */
    APP_ROOT: string
    /** /dist/ or /public/ */
    VITE_PUBLIC: string
  }
}

// Used in Renderer process, expose in `preload.ts`
interface Window {
  ipcRenderer: import('electron').IpcRenderer
  electronAPI: {
    getModelPath: (modelName: string) => string
    onMousePosition: (callback: (position: { x: number, y: number }) => void) => void
    removeMousePositionListener: () => void
    setIgnoreMouseEvents: (options: { ignore: boolean, forward?: boolean }) => void
    onMouseEnterWindow: (callback: () => void) => void
    takeScreenshot: () => Promise<string | null>
    toggleScreenshotRoast: (enabled: boolean) => Promise<boolean>
    setScreenshotInterval: (intervalMinutes: number) => Promise<number>
    getScreenshotStatus: () => Promise<{ enabled: boolean, interval: number }>
    onScreenshotCaptured: (callback: (screenshot: string) => void) => void
    onHotkeyScreenshotRoast: (callback: (screenshot: string) => void) => void
    removeScreenshotListeners: () => void
  }
}
