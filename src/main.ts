import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import ui from '@nuxt/ui/vue-plugin'
import App from './App.vue'
import './style.css'
import 'virtual:uno.css'

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
