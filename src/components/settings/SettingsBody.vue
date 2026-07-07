<script setup lang="ts">
import type { GazeAtUserConfig, GazeAtUserConfigUpdate } from '../../composables/useGaze'
import type { RoastStyle } from '../../utils/screenshot-prompts'
import type { RoastResult, ScreenshotRoastConfig } from '../../utils/screenshot-roast'
import CharacterSettings from './tabs/CharacterSettings.vue'
import GazeSettings from './tabs/GazeSettings.vue'
import OpenAISettings from './tabs/OpenAISettings.vue'
import RoastSettings from './tabs/RoastSettings.vue'

defineProps<{
  activeTab: 'openai' | 'character' | 'roast' | 'gaze'
  currentCharacterId: string | null
  characterRefreshKey?: number
  roastConfig: ScreenshotRoastConfig
  isRoasting: boolean
  currentRoast: RoastResult | null
  roastHistory: RoastResult[]
  gazeAtUserConfig: GazeAtUserConfig
}>()

const emit = defineEmits<{
  (e: 'characterSelect', payload: any): void
  (e: 'characterEdit', payload: any): void
  (e: 'characterDelete', payload: any): void
  (e: 'characterCreate'): void
  (e: 'roastToggleAuto'): void
  (e: 'roastSetInterval', minutes: number): void
  (e: 'roastSetStyle', style: RoastStyle): void
  (e: 'roastTrigger'): void
  (e: 'roastClearHistory'): void
  (e: 'gazeUpdateConfig', cfg: GazeAtUserConfigUpdate): void
  (e: 'gazeTestLock'): void
}>()
</script>

<template>
  <CharacterSettings
    v-if="activeTab === 'character'"
    :current-character-id="currentCharacterId"
    :refresh-key="characterRefreshKey ?? 0"
    @select="e => emit('characterSelect', e)"
    @edit="e => emit('characterEdit', e)"
    @delete="e => emit('characterDelete', e)"
    @create="() => emit('characterCreate')"
  />

  <OpenAISettings v-else-if="activeTab === 'openai'" />

  <RoastSettings
    v-else-if="activeTab === 'roast'"
    :roast-config="roastConfig"
    :is-roasting="isRoasting"
    :current-roast="currentRoast"
    :roast-history="roastHistory"
    @toggle-auto="() => emit('roastToggleAuto')"
    @set-interval="m => emit('roastSetInterval', m)"
    @set-style="s => emit('roastSetStyle', s)"
    @trigger="() => emit('roastTrigger')"
    @clear-history="() => emit('roastClearHistory')"
  />

  <GazeSettings
    v-else
    :gaze-config="gazeAtUserConfig"
    @update-config="cfg => emit('gazeUpdateConfig', cfg)"
    @test-lock="() => emit('gazeTestLock')"
  />
</template>
