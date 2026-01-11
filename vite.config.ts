import path from 'node:path'
import vue from '@vitejs/plugin-vue'
import ui from '@nuxt/ui/vite'
import UnoCSS from 'unocss/vite'
import { defineConfig } from 'vite'
import electron from 'vite-plugin-electron/simple'
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    ui(),
    UnoCSS(),
    electron({
      main: {
        // Shortcut of `build.lib.entry`.
        entry: 'electron/main.ts',
      },
      preload: {
        // Shortcut of `build.rollupOptions.input`.
        // Preload scripts may contain Web assets, so use the `build.rollupOptions.input` instead `build.lib.entry`.
        input: path.join(import.meta.dirname, 'electron/preload.ts'),
        vite: {
          build: {
            rollupOptions: {
              output: {
                format: 'cjs',
              },
            },
          },
        },
      },
      // Ployfill the Electron and Node.js API for Renderer process.
      // If you want use Node.js in Renderer process, the `nodeIntegration` needs to be enabled in the Main process.
      // See 👉 https://github.com/electron-vite/vite-plugin-electron-renderer
      // eslint-disable-next-line node/prefer-global/process
      renderer: process.env.NODE_ENV === 'test'
        // https://github.com/electron-vite/vite-plugin-electron-renderer/issues/78#issuecomment-2053600808
        ? undefined
        : {},
    }),
  ],
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      url: path.resolve(import.meta.dirname, 'src/utils/url-polyfill.js'),
      path: 'path-browserify',
    },
  },
  optimizeDeps: {
    include: ['pixi.js', '@jannchie/pixi-live2d-display'],
    exclude: [],
  },
})
