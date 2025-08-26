import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, protocol, screen } from "electron";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname, "..");
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
app.commandLine.appendSwitch("--enable-unsafe-swiftshader");
app.commandLine.appendSwitch("--ignore-gpu-blacklist");
app.commandLine.appendSwitch("--enable-gpu-rasterization");
app.commandLine.appendSwitch("--enable-accelerated-2d-canvas");
app.commandLine.appendSwitch("--disable-background-timer-throttling");
app.commandLine.appendSwitch("--disable-backgrounding-occluded-windows");
function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.bounds;
  win = new BrowserWindow({
    width,
    height,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  win.setIgnoreMouseEvents(false, { forward: true });
  win.webContents.on("ipc-message", (_, channel, data) => {
    if (channel === "set-ignore-mouse-events") {
      win?.setIgnoreMouseEvents(data.ignore, { forward: data.forward || true });
    }
  });
  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
  win.webContents.on("before-input-event", (_, input) => {
    if (input.key === "F12" || input.control && input.shift && input.key === "I") {
      win?.webContents.openDevTools({ mode: "detach" });
    }
  });
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.disableHardwareAcceleration();
app.whenReady().then(() => {
  protocol.handle("app", (request) => {
    const url = request.url.slice("app://".length);
    const filePath = path.join(process.env.VITE_PUBLIC || path.join(process.env.APP_ROOT, "public"), url);
    try {
      return fs.existsSync(filePath) ? new Response(fs.readFileSync(filePath), {
        headers: {
          "Content-Type": getContentType(filePath),
          "Access-Control-Allow-Origin": "*"
        }
      }) : new Response("File not found", { status: 404 });
    } catch (error) {
      console.error("Error loading file:", error);
      return new Response("Error loading file", { status: 500 });
    }
  });
  createWindow();
});
function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    ".json": "application/json",
    ".moc3": "application/octet-stream",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".cdi3": "application/json",
    ".motion3": "application/json",
    ".physics3": "application/json",
    ".pose3": "application/json"
  };
  return mimeTypes[ext] || "application/octet-stream";
}
app.on("before-quit", () => {
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
