import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
import 'virtual:uno.css'

createApp(App).mount('#app').$nextTick(() => {
  // Use contextBridge (only in electron context)
  if ((globalThis as any).ipcRenderer) {
    (globalThis as any).ipcRenderer.on('main-process-message', (_event: any, message: any) => {
      // eslint-disable-next-line no-console
      console.log(message)
    })
  }
})
