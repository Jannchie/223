import { createApp } from 'vue'
import App from './App.vue'
import ui from './components/ui'
import './style.css'

const urlParams = new URLSearchParams(globalThis.location.search)
const isOverlayWindow = urlParams.get('settings') !== 'true'
if (typeof document !== 'undefined') {
  document.documentElement.classList.toggle('overlay-window', isOverlayWindow)
  document.body.classList.toggle('overlay-window', isOverlayWindow)
}

const app = createApp(App)
app.use(ui)

app.mount('#app').$nextTick(() => {
  // Use contextBridge (only in electron context)
  if ((globalThis as any).ipcRenderer) {
    (globalThis as any).ipcRenderer.on('main-process-message', (_event: any, message: any) => {
      console.log(message)
    })
  }
})
