import { defineConfig, presetAttributify, presetIcons, presetTypography, presetWind4 } from 'unocss'

export default defineConfig({
  presets: [
    presetWind4(),
    presetAttributify(),
    presetTypography(),
    presetIcons({
      collections: {
        carbon: () => import('@iconify/json/json/carbon.json').then(i => i.default),
        material: () => import('@iconify/json/json/material-symbols.json').then(i => i.default),
      },
    }),
  ],
})
