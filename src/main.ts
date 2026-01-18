import ui from '@nuxt/ui/vue-plugin'
import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import './style.css'

const urlParams = new URLSearchParams(globalThis.location.search)
const isOverlayWindow = !(urlParams.get('settings') === 'true' || urlParams.get('recording') === 'true')
if (typeof document !== 'undefined') {
  document.documentElement.classList.toggle('overlay-window', isOverlayWindow)
  document.body.classList.toggle('overlay-window', isOverlayWindow)
}

const app = createApp(App)
const router = createRouter({
  history: createWebHistory(),
  routes: [],
})

app.use(router)
app.use(ui)

app.mount('#app').$nextTick(() => {
  // Use contextBridge (only in electron context)
  if ((globalThis as any).ipcRenderer) {
    (globalThis as any).ipcRenderer.on('main-process-message', (_event: any, message: any) => {
      console.log(message)
    })
  }
})
