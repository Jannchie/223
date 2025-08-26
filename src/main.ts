import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

createApp(App).mount('#app').$nextTick(() => {
  // Use contextBridge (only in electron context)
  if ((window as any).ipcRenderer) {
    (window as any).ipcRenderer.on('main-process-message', (_event: any, message: any) => {
      console.log(message)
    })
  }
})
