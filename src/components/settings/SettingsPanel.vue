<script setup lang="ts">
import type { GazeAtUserConfig, GazeAtUserConfigUpdate } from '../../composables/useGaze'
import type { RoastStyle } from '../../utils/screenshot-prompts'
import type { RoastResult, ScreenshotRoastConfig } from '../../utils/screenshot-roast'
import { computed } from 'vue'
import SettingsShell from './SettingsShell.vue'

const props = defineProps<{
  visible: boolean
  embedded?: boolean
  activeTab: 'openai' | 'character' | 'roast' | 'gaze'
  // OpenAI
  apiKey: string
  baseURL: string
  // Character
  currentCharacterId: string | null
  characterRefreshKey?: number
  // Roast
  roastConfig: ScreenshotRoastConfig
  isRoasting: boolean
  currentRoast: RoastResult | null
  roastHistory: RoastResult[]
  // Gaze
  gazeAtUserConfig: GazeAtUserConfig
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'cancel'): void
  (e: 'save'): void
  (e: 'update:activeTab', tab: 'openai' | 'character' | 'roast' | 'gaze'): void
  (e: 'update:apiKey', v: string): void
  (e: 'update:baseURL', v: string): void
  // Character
  (e: 'characterSelect', payload: any): void
  (e: 'characterEdit', payload: any): void
  (e: 'characterDelete', payload: any): void
  (e: 'characterCreate'): void
  // Roast
  (e: 'roastToggleAuto'): void
  (e: 'roastSetInterval', minutes: number): void
  (e: 'roastSetStyle', style: RoastStyle): void
  (e: 'roastTrigger'): void
  (e: 'roastClearHistory'): void
  // Gaze
  (e: 'gazeUpdateConfig', cfg: GazeAtUserConfigUpdate): void
  (e: 'gazeTestLock'): void
}>()

const cancelLabel = computed(() => (props.embedded ? '关闭' : '取消'))

// 转发给 SettingsBody 的数据与事件（避免模态/独立窗口两处重复）
const bodyProps = computed(() => ({
  activeTab: props.activeTab,
  currentCharacterId: props.currentCharacterId,
  characterRefreshKey: props.characterRefreshKey,
  roastConfig: props.roastConfig,
  isRoasting: props.isRoasting,
  currentRoast: props.currentRoast,
  roastHistory: props.roastHistory,
  gazeAtUserConfig: props.gazeAtUserConfig,
}))

const bodyHandlers = {
  characterSelect: (e: any) => emit('characterSelect', e),
  characterEdit: (e: any) => emit('characterEdit', e),
  characterDelete: (e: any) => emit('characterDelete', e),
  characterCreate: () => emit('characterCreate'),
  roastToggleAuto: () => emit('roastToggleAuto'),
  roastSetInterval: (m: number) => emit('roastSetInterval', m),
  roastSetStyle: (s: RoastStyle) => emit('roastSetStyle', s),
  roastTrigger: () => emit('roastTrigger'),
  roastClearHistory: () => emit('roastClearHistory'),
  gazeUpdateConfig: (cfg: GazeAtUserConfigUpdate) => emit('gazeUpdateConfig', cfg),
  gazeTestLock: () => emit('gazeTestLock'),
}

function handleModalOpenChange(open: boolean) {
  if (!open) {
    emit('cancel')
  }
}
</script>

<template>
  <!-- 弹窗形态 -->
  <Modal
    v-if="!embedded"
    :open="visible"
    :close="false"
    :ui="{ content: 'max-w-2xl' }"
    @update:open="handleModalOpenChange"
  >
    <template #content>
      <div class="flex h-[600px] max-h-[85vh] bg-default">
        <SettingsShell
          :active-tab="activeTab"
          :cancel-label="cancelLabel"
          :body-props="bodyProps"
          :body-handlers="bodyHandlers"
          @update:active-tab="tab => emit('update:activeTab', tab)"
          @cancel="emit('cancel')"
          @save="emit('save')"
        />
      </div>
    </template>
  </Modal>

  <!-- 独立设置窗口形态 -->
  <div
    v-else-if="visible"
    class="flex h-screen w-screen bg-default"
    @keydown.stop
    @keyup.stop
    @keypress.stop
  >
    <SettingsShell
      :active-tab="activeTab"
      :cancel-label="cancelLabel"
      :body-props="bodyProps"
      :body-handlers="bodyHandlers"
      @update:active-tab="tab => emit('update:activeTab', tab)"
      @cancel="emit('cancel')"
      @save="emit('save')"
    />
  </div>
</template>
