/* eslint-disable node/prefer-global/process */
import fs from 'node:fs'
import path from 'node:path'
// import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { app, BrowserWindow, Menu, nativeImage, protocol, screen, Tray } from 'electron'

// const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 处理未捕获的 Promise 拒绝
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Promise Rejection at:', promise, 'reason:', reason)
})

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
})

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.js
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null
let tray: Tray | null = null
let mouseTrackingInterval: NodeJS.Timeout | null = null
let lastMousePosition = { x: -1, y: -1 } // 记录上次鼠标位置

// GPU 和性能优化配置
app.commandLine.appendSwitch('--enable-gpu-rasterization')
app.commandLine.appendSwitch('--enable-accelerated-2d-canvas')
app.commandLine.appendSwitch('--disable-background-timer-throttling')
app.commandLine.appendSwitch('--disable-backgrounding-occluded-windows')
// 减少 GPU stall
app.commandLine.appendSwitch('--max-gum-fps=30')

function createWindow() {
  // 获取主显示器的完整尺寸（包括任务栏区域）
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.bounds

  win = new BrowserWindow({
    width,
    height,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  // 初始设置：完全穿透，让底层应用接收所有鼠标事件
  win.setIgnoreMouseEvents(true, { forward: true })

  // 监听渲染进程的消息来动态控制鼠标事件
  win.webContents.on('ipc-message', (_, channel, data) => {
    if (channel === 'set-ignore-mouse-events') {
      win?.setIgnoreMouseEvents(data.ignore, { forward: data.forward !== false })
    }
  })

  // 添加鼠标进入/离开窗口的事件监听
  win.on('mouse-enter', () => {
    // 鼠标进入窗口时，先检查是否在交互区域
    if (win && !win.isDestroyed()) {
      win.webContents.send('mouse-enter-window')
    }
  })

  win.on('mouse-leave', () => {
    // 鼠标离开窗口时，恢复完全穿透
    if (win && !win.isDestroyed()) {
      win.setIgnoreMouseEvents(true, { forward: true })
    }
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date()).toLocaleString())
  })

  // Enable dev tools in development mode
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
    win.webContents.openDevTools({ mode: 'detach' })
  }
  else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }

  // Add keyboard shortcut to open dev tools
  win.webContents.on('before-input-event', (_, input) => {
    if (input.key === 'F12' || (input.control && input.shift && input.key === 'I')) {
      win?.webContents.openDevTools({ mode: 'detach' })
    }
  })

  // 开始全局鼠标位置跟踪
  startMouseTracking()

  // 创建系统托盘
  createTray()
}

// 创建系统托盘函数
function createTray() {
  try {
    // 在 Windows 系统上，SVG 文件可能不被支持，使用空的图像创建托盘
    // 或者创建一个简单的 PNG 图标
    let iconPath: string

    if (process.platform === 'win32') {
      // Windows 需要 ICO 或 PNG 格式
      iconPath = path.join(__dirname, '..', 'build', 'icon.ico')
      if (fs.existsSync(iconPath)) {
        tray = new Tray(iconPath)
      }
      else {
        // 如果没有图标文件，创建一个最小的托盘
        console.warn('No icon found, creating system tray with default icon')
        // Windows 可以使用 nativeImage 创建空图标
        const emptyIcon = nativeImage.createEmpty()
        tray = new Tray(emptyIcon)
      }
    }
    else {
      // macOS 和 Linux 可以使用 PNG
      iconPath = path.join(process.env.VITE_PUBLIC, 'vite.svg')
      if (!fs.existsSync(iconPath)) {
        console.warn('Tray icon not found, skipping system tray creation')
        return
      }
      tray = new Tray(iconPath)
    }
  }
  catch (error) {
    console.error('Failed to create system tray:', error)
    return
  }

  if (!tray) {
    console.warn('System tray not created')
    return
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'NiNiSan',
      type: 'normal',
      enabled: false,
    },
    {
      type: 'separator',
    },
    {
      label: '显示/隐藏',
      type: 'normal',
      click: () => {
        if (win) {
          if (win.isVisible()) {
            win.hide()
          }
          else {
            win.show()
          }
        }
      },
    },
    {
      label: '退出',
      type: 'normal',
      click: () => {
        app.quit()
      },
    },
  ])

  tray.setContextMenu(contextMenu)
  tray.setToolTip('NiNiSan - 桌面助手')

  // 双击托盘图标显示/隐藏窗口
  tray.on('double-click', () => {
    if (win) {
      if (win.isVisible()) {
        win.hide()
      }
      else {
        win.show()
      }
    }
  })
}

// 全局鼠标位置跟踪函数
function startMouseTracking() {
  if (mouseTrackingInterval) {
    clearInterval(mouseTrackingInterval)
  }

  mouseTrackingInterval = setInterval(() => {
    if (win && !win.isDestroyed()) {
      const mousePos = screen.getCursorScreenPoint()

      // 只有鼠标位置真正变化时才发送事件
      if (mousePos.x !== lastMousePosition.x || mousePos.y !== lastMousePosition.y) {
        lastMousePosition = { x: mousePos.x, y: mousePos.y }
        win.webContents.send('mouse-position', { x: mousePos.x, y: mousePos.y })
      }
    }
  }, 33) // ~30fps, 降低频率减少不必要的检查
}

// 停止鼠标位置跟踪
function stopMouseTracking() {
  if (mouseTrackingInterval) {
    clearInterval(mouseTrackingInterval)
    mouseTrackingInterval = null
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  stopMouseTracking()
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// Enable hardware acceleration for better performance
// app.disableHardwareAcceleration() // Commented out for better Live2D performance

// eslint-disable-next-line unicorn/prefer-top-level-await
app.whenReady().then(() => {
  // 注册自定义协议来处理本地文件
  protocol.handle('app', (request) => {
    const url = request.url.slice('app://'.length)
    const filePath = path.join(process.env.VITE_PUBLIC || path.join(process.env.APP_ROOT, 'public'), url)

    try {
      // 检查文件是否存在
      return fs.existsSync(filePath)
        ? new Response(fs.readFileSync(filePath), {
          headers: {
            'Content-Type': getContentType(filePath),
            'Access-Control-Allow-Origin': '*',
          },
        })
        : new Response('File not found', { status: 404 })
    }
    catch (error) {
      console.error('Error loading file:', error)
      return new Response('Error loading file', { status: 500 })
    }
  })

  createWindow()
})

// 根据文件扩展名获取 Content-Type
function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  const mimeTypes: Record<string, string> = {
    '.json': 'application/json',
    '.moc3': 'application/octet-stream',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.cdi3': 'application/json',
    '.motion3': 'application/json',
    '.physics3': 'application/json',
    '.pose3': 'application/json',
  }
  return mimeTypes[ext] || 'application/octet-stream'
}

// 应用退出时清理
app.on('before-quit', () => {
  stopMouseTracking()
  if (tray) {
    tray.destroy()
    tray = null
  }
})
