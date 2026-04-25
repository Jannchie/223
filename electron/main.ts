import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
// import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { app, BrowserWindow, desktopCapturer, globalShortcut, ipcMain, Menu, nativeImage, protocol, screen, session, Tray } from 'electron'

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
let settingsWin: BrowserWindow | null = null // 设置窗口
let tray: Tray | null = null
let mouseTrackingInterval: NodeJS.Timeout | null = null
let lastMousePosition = { x: -1, y: -1 } // 记录上次鼠标位置
let staticServer: http.Server | null = null
let serverPort = 0 // 动态分配的端口号
let alwaysOnTopInterval: NodeJS.Timeout | null = null

// 截图相关变量
let screenshotRoastTimer: NodeJS.Timeout | null = null
let screenshotRoastEnabled = false
let screenshotRoastInterval = 5 * 60 * 1000 // 默认 5 分钟

type ScreenshotCaptureReason = 'manual' | 'auto-roast' | 'hotkey-roast'

interface ScreenshotSize {
  width: number
  height: number
}

const screenshotDebugDirectoryName = 'vision-debug-screenshots'

// GPU 和性能优化配置
app.commandLine.appendSwitch('--enable-gpu-rasterization')
app.commandLine.appendSwitch('--enable-accelerated-2d-canvas')
app.commandLine.appendSwitch('--disable-background-timer-throttling')
app.commandLine.appendSwitch('--disable-backgrounding-occluded-windows')
// 减少 GPU stall
app.commandLine.appendSwitch('--max-gum-fps=30')

// 媒体设备权限配置
app.commandLine.appendSwitch('--enable-media-stream')
app.commandLine.appendSwitch('--use-fake-ui-for-media-stream') // 自动授权媒体权限
app.commandLine.appendSwitch('--disable-features=VizDisplayCompositor') // 有助于媒体流
app.commandLine.appendSwitch('--autoplay-policy=no-user-gesture-required') // 允许自动播放

async function createWindow() {
  // 先启动静态文件服务器
  try {
    await createStaticServer()
  }
  catch (error) {
    console.error('Failed to start static server:', error)
  }

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
    type: 'toolbar', // 在某些系统上有助于保持置顶
    icon: path.join(process.env.VITE_PUBLIC, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // 允许跨域资源，对语音识别有帮助
      allowRunningInsecureContent: true, // 允许不安全内容，有助于本地功能
      experimentalFeatures: true, // 启用实验性功能
    },
  })

  // 强制确保窗口始终置顶
  win.setAlwaysOnTop(true, 'screen-saver')

  // 监听焦点变化，确保保持置顶
  win.on('blur', () => {
    if (win && !win.isDestroyed()) {
      win.setAlwaysOnTop(false)
      win.setAlwaysOnTop(true, 'screen-saver')
    }
  })

  // 定时检查确保窗口保持置顶（每5秒检查一次）
  alwaysOnTopInterval = setInterval(() => {
    if (win && !win.isDestroyed() && !win.isAlwaysOnTop()) {
      win.setAlwaysOnTop(true, 'screen-saver')
    }
  }, 5000)

  // 初始设置：不穿透，让前端控制穿透逻辑
  win.setIgnoreMouseEvents(false, { forward: false })

  // 监听渲染进程的消息来动态控制鼠标事件
  win.webContents.on('ipc-message', (_, channel, data) => {
    if (channel === 'set-ignore-mouse-events') {
      win?.setIgnoreMouseEvents(data.ignore, { forward: data.forward !== false })
    }
  })

  // 设置 IPC 处理器
  setupIpcHandlers()

  // 注册 F7 快捷键用于截图吐槽
  registerGlobalShortcuts()

  // 移除无效的鼠标进入/离开窗口事件监听
  // 可以在渲染进程中使用 'mouseenter' 和 'mouseleave' 事件，或继续使用全局鼠标跟踪

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date()).toLocaleString())
    // 将服务器端口发送给渲染进程
    win?.webContents.send('static-server-port', serverPort)
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

// 创建设置窗口
async function createSettingsWindow() {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.focus()
    return
  }

  settingsWin = new BrowserWindow({
    width: 720,
    height: 760,
    minWidth: 520,
    minHeight: 520,
    transparent: false,
    frame: true,
    alwaysOnTop: false,
    skipTaskbar: false,
    resizable: true,
    title: 'NiNiSan - 设置',
    backgroundColor: '#f5f6f8',
    icon: path.join(process.env.VITE_PUBLIC, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    settingsWin.loadURL(`${VITE_DEV_SERVER_URL}?settings=true`)
  }
  else {
    settingsWin.loadFile(path.join(RENDERER_DIST, 'index.html'), {
      query: { settings: 'true' },
    })
  }

  settingsWin.setMenu(null)

  settingsWin.webContents.on('before-input-event', (_, input) => {
    if (input.key === 'F12' || (input.control && input.shift && input.key === 'I')) {
      settingsWin?.webContents.openDevTools({ mode: 'detach' })
    }
  })

  settingsWin.webContents.on('context-menu', (_, params) => {
    if (!settingsWin) {
      return
    }
    const template = [
      { role: 'cut', enabled: params.editFlags.canCut },
      { role: 'copy', enabled: params.editFlags.canCopy },
      { role: 'paste', enabled: params.editFlags.canPaste },
    ] as Electron.MenuItemConstructorOptions[]

    if (VITE_DEV_SERVER_URL) {
      template.push({ type: 'separator' }, {
        label: 'Inspect Element',
        click: () => settingsWin?.webContents.inspectElement(params.x, params.y),
      }, {
        label: 'Toggle DevTools',
        click: () => settingsWin?.webContents.openDevTools({ mode: 'detach' }),
      })
    }

    Menu.buildFromTemplate(template).popup({ window: settingsWin })
  })

  settingsWin.on('closed', () => {
    settingsWin = null
  })

  return settingsWin
}

// 创建系统托盘函数
function createTray() {
  try {
    let iconPath: string

    if (process.platform === 'win32') {
      // Windows 先尝试使用 PNG，如果失败则使用空图标
      iconPath = path.join(process.env.VITE_PUBLIC, 'icon.png')
      if (fs.existsSync(iconPath)) {
        try {
          tray = new Tray(iconPath)
        }
        catch {
          const emptyIcon = nativeImage.createEmpty()
          tray = new Tray(emptyIcon)
        }
      }
      else {
        console.warn('No icon found, creating system tray with empty icon')
        const emptyIcon = nativeImage.createEmpty()
        tray = new Tray(emptyIcon)
      }
    }
    else {
      // macOS 和 Linux 可以使用 PNG
      iconPath = path.join(process.env.VITE_PUBLIC, 'icon.png')
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
      type: 'separator',
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

// 停止置顶检查
function stopAlwaysOnTopCheck() {
  if (alwaysOnTopInterval) {
    clearInterval(alwaysOnTopInterval)
    alwaysOnTopInterval = null
  }
}

// 创建本地静态文件服务器
function createStaticServer(): Promise<number> {
  return new Promise((resolve, reject) => {
    const publicPath = VITE_DEV_SERVER_URL
      ? (process.env.VITE_PUBLIC || path.join(process.env.APP_ROOT, 'public'))
      : RENDERER_DIST

    staticServer = http.createServer((req, res) => {
      // 解析请求的 URL
      const urlPath = req.url || '/'
      const filePath = path.join(publicPath, urlPath)

      // 安全检查：确保请求的文件在允许的目录内
      const normalizedPath = path.normalize(filePath)
      const normalizedPublicPath = path.normalize(publicPath)

      if (!normalizedPath.startsWith(normalizedPublicPath)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' })
        res.end('Forbidden')
        return
      }

      try {
        // 检查文件是否存在
        if (!fs.existsSync(filePath)) {
          res.writeHead(404, { 'Content-Type': 'text/plain' })
          res.end('Not Found')
          return
        }

        // 获取文件内容和类型
        const data = fs.readFileSync(filePath)
        const contentType = getContentType(filePath)

        // 设置 CORS 头部，允许跨域访问
        res.writeHead(200, {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        })

        res.end(data)
      }
      catch (error) {
        console.error('Error serving file:', error)
        res.writeHead(500, { 'Content-Type': 'text/plain' })
        res.end('Internal Server Error')
      }
    })

    // 监听动态端口
    staticServer.listen(0, '127.0.0.1', () => {
      const address = staticServer?.address()
      if (address && typeof address === 'object') {
        serverPort = address.port
        resolve(serverPort)
      }
      else {
        reject(new Error('Failed to get server port'))
      }
    })

    staticServer.on('error', (error) => {
      console.error('Static server error:', error)
      reject(error)
    })
  })
}

// 停止静态文件服务器
function stopStaticServer() {
  if (staticServer) {
    staticServer.close()
    staticServer = null
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  stopMouseTracking()
  stopAlwaysOnTopCheck()
  stopStaticServer()
  stopScreenshotRoast()
  unregisterGlobalShortcuts()
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

app.whenReady().then(() => {
  // 处理麦克风权限
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    console.log('权限请求:', permission)
    if (permission === 'media') {
      callback(true)
    }
    else {
      callback(false)
    }
  })

  session.defaultSession.setPermissionCheckHandler((_webContents, permission, requestingOrigin) => {
    console.log('权限检查:', permission, 'Origin:', requestingOrigin)
    if (permission === 'media') {
      return true
    }
    return false
  })

  // 设置媒体设备权限
  session.defaultSession.setDevicePermissionHandler((details) => {
    console.log('设备权限请求:', details)
    // 仅处理 WebHID/WebSerial/WebUSB 等设备权限。麦克风由 'media' 权限控制。
    if (details.deviceType === 'hid' || details.deviceType === 'serial' || details.deviceType === 'usb') {
      return false
    }
    return false
  })

  // 注册自定义协议来处理本地文件
  protocol.handle('app', (request) => {
    const url = request.url.slice('app://'.length)
    // 在生产环境使用 RENDERER_DIST，开发环境使用 VITE_PUBLIC
    const publicPath = VITE_DEV_SERVER_URL
      ? (process.env.VITE_PUBLIC || path.join(process.env.APP_ROOT, 'public'))
      : RENDERER_DIST
    const filePath = path.join(publicPath, url)

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

function getScreenshotDebugDirectory(): string {
  const configuredDirectory = process.env.NINISAN_VISION_DEBUG_DIR?.trim()
  if (configuredDirectory) {
    return path.resolve(configuredDirectory)
  }

  return path.join(app.getPath('userData'), screenshotDebugDirectoryName)
}

function padNumber(value: number, size = 2): string {
  return String(value).padStart(size, '0')
}

function formatDebugTimestamp(date: Date): string {
  return `${date.getFullYear()}${padNumber(date.getMonth() + 1)}${padNumber(date.getDate())}-${padNumber(date.getHours())}${padNumber(date.getMinutes())}${padNumber(date.getSeconds())}-${padNumber(date.getMilliseconds(), 3)}`
}

function sanitizeFilenamePart(value: string): string {
  const sanitizedValue = value
    .trim()
    .replaceAll(/[<>:"/\\|?*\u0000-\u001F]+/g, '_')
    .replaceAll(/\s+/g, '-')
    .replaceAll(/_+/g, '_')
    .slice(0, 80)

  return sanitizedValue || 'source'
}

function getScreenshotThumbnailSize(): ScreenshotSize {
  const primaryDisplay = screen.getPrimaryDisplay()
  const longEdgeLimit = 1920
  const longEdge = Math.max(primaryDisplay.size.width, primaryDisplay.size.height)
  const scale = longEdge > longEdgeLimit ? longEdgeLimit / longEdge : 1

  return {
    width: Math.round(primaryDisplay.size.width * scale),
    height: Math.round(primaryDisplay.size.height * scale),
  }
}

function saveVisionDebugScreenshot(
  pngData: Buffer,
  reason: ScreenshotCaptureReason,
  sourceName: string,
  imageSize: ScreenshotSize,
): string | null {
  try {
    const debugDirectory = getScreenshotDebugDirectory()
    fs.mkdirSync(debugDirectory, { recursive: true })

    const filename = [
      formatDebugTimestamp(new Date()),
      reason,
      `${imageSize.width}x${imageSize.height}`,
      sanitizeFilenamePart(sourceName),
    ].join('-')
    const filePath = path.join(debugDirectory, `${filename}.png`)

    fs.writeFileSync(filePath, pngData)
    console.log(`Saved vision debug screenshot: ${filePath}`)
    return filePath
  }
  catch (error) {
    console.error('Failed to save vision debug screenshot:', error)
    return null
  }
}

// Capture the exact image that will be sent to the vision model.
async function captureScreenshot(reason: ScreenshotCaptureReason = 'manual'): Promise<string | null> {
  try {
    const thumbnailSize = getScreenshotThumbnailSize()
    const primaryDisplay = screen.getPrimaryDisplay()
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize,
    })

    if (sources.length === 0) {
      console.error('No screenshot sources available')
      return null
    }

    // Prefer the primary screen so protected or minimized window thumbnails do not look like black frames.
    const screenSources = sources.filter(source => source.id.startsWith('screen:'))
    const windowSources = sources.filter(source => !source.id.startsWith('screen:'))
    const primaryScreenSource = screenSources.find(source => source.display_id === String(primaryDisplay.id))
    const fallbackWindowSource = windowSources.find(source =>
      source.name
      && !source.name.includes('NiNiSan')
      && !source.name.includes('Electron')
      && source.name.trim() !== '',
    )
    const targetSource = primaryScreenSource ?? screenSources[0] ?? fallbackWindowSource ?? sources[0]

    const screenshot = targetSource.thumbnail
    if (screenshot.isEmpty()) {
      console.error(`Captured screenshot is empty: ${targetSource.name}`)
      return null
    }

    const pngData = screenshot.toPNG()
    saveVisionDebugScreenshot(pngData, reason, targetSource.name, screenshot.getSize())

    const base64Data = pngData.toString('base64')
    return `data:image/png;base64,${base64Data}`
  }
  catch (error) {
    console.error('Screenshot capture failed:', error)
    return null
  }
}

// 启动截图吐槽定时器
function startScreenshotRoast() {
  if (screenshotRoastTimer) {
    clearInterval(screenshotRoastTimer)
  }

  screenshotRoastTimer = setInterval(async () => {
    if (screenshotRoastEnabled && win && !win.isDestroyed()) {
      const screenshot = await captureScreenshot('auto-roast')
      if (screenshot) {
        win.webContents.send('screenshot-captured', screenshot)
      }
    }
  }, screenshotRoastInterval)
}

// 停止截图吐槽定时器
function stopScreenshotRoast() {
  if (screenshotRoastTimer) {
    clearInterval(screenshotRoastTimer)
    screenshotRoastTimer = null
  }
}

// 设置 IPC 处理器
function setupIpcHandlers() {
  // 手动截图
  ipcMain.handle('take-screenshot', async () => {
    return await captureScreenshot('manual')
  })

  // 启用/禁用截图吐槽
  ipcMain.handle('toggle-screenshot-roast', (_, enabled: boolean) => {
    screenshotRoastEnabled = enabled
    if (enabled) {
      startScreenshotRoast()
    }
    else {
      stopScreenshotRoast()
    }
    return screenshotRoastEnabled
  })

  // 设置截图间隔
  ipcMain.handle('set-screenshot-interval', (_, intervalMinutes: number) => {
    screenshotRoastInterval = intervalMinutes * 60 * 1000
    if (screenshotRoastEnabled) {
      startScreenshotRoast() // 重新启动定时器
    }
    return screenshotRoastInterval
  })

  // 获取截图状态
  ipcMain.handle('get-screenshot-status', () => {
    return {
      enabled: screenshotRoastEnabled,
      interval: screenshotRoastInterval / 60 / 1000, // 转换为分钟
    }
  })

  // 打开设置窗口
  ipcMain.handle('open-settings-window', async () => {
    await createSettingsWindow()
    return !!settingsWin
  })

  // 关闭设置窗口
  ipcMain.handle('close-settings-window', () => {
    if (settingsWin && !settingsWin.isDestroyed()) {
      settingsWin.close()
      return true
    }
    return false
  })

  // 获取设置窗口状态
  ipcMain.handle('get-settings-window-status', () => {
    return settingsWin && !settingsWin.isDestroyed()
  })
}

// 注册全局快捷键
function registerGlobalShortcuts() {
  try {
    // 注册 F7 快捷键触发截图吐槽
    const ret1 = globalShortcut.register('F7', async () => {
      if (win && !win.isDestroyed()) {
        // 触发截图吐槽
        const screenshot = await captureScreenshot('hotkey-roast')
        if (screenshot) {
          win.webContents.send('hotkey-screenshot-roast', screenshot)
        }
      }
    })

    if (ret1) {
      console.log('F7 快捷键注册成功')
    }
    else {
      console.log('F7 快捷键注册失败')
    }

    // 注册 F6 快捷键触发语音识别
    const ret2 = globalShortcut.register('F6', () => {
      if (win && !win.isDestroyed()) {
        // 触发语音识别
        win.webContents.send('hotkey-voice-recognition')
      }
    })

    if (ret2) {
      console.log('F6 快捷键注册成功')
    }
    else {
      console.log('F6 快捷键注册失败')
    }
  }
  catch (error) {
    console.error('注册快捷键失败:', error)
  }
}

// 注销全局快捷键
function unregisterGlobalShortcuts() {
  globalShortcut.unregisterAll()
}

// 应用退出时清理
app.on('before-quit', () => {
  stopMouseTracking()
  stopAlwaysOnTopCheck()
  stopStaticServer()
  stopScreenshotRoast()
  unregisterGlobalShortcuts()
  if (tray) {
    tray.destroy()
    tray = null
  }
})
