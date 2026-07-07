import path from 'node:path'
import ui from '@nuxt/ui/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import electron from 'vite-plugin-electron/simple'
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    ui({
      ui: {
        colors: {
          primary: 'teal',
          neutral: 'zinc',
        },
        button: {
          slots: {
            base: 'rounded-lg font-medium',
          },
        },
      },
    }),
    electron({
      main: {
        // Shortcut of `build.lib.entry`.
        entry: 'electron/main.ts',
        vite: {
          build: {
            // electron-updater 需在运行时从 asar 内的 node_modules 加载，
            // 不能被打包进 main.js，否则会破坏 app-update.yml 的路径解析
            rollupOptions: {
              external: ['electron-updater'],
            },
            rolldownOptions: {
              external: ['electron-updater'],
            },
          },
        },
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
