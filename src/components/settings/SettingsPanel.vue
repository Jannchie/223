<script setup lang="ts">
import type { GazeAtUserConfig, GazeAtUserConfigUpdate } from '../../composables/useGaze'
import type { RoastStyle } from '../../utils/screenshot-prompts'
import type { RoastResult, ScreenshotRoastConfig } from '../../utils/screenshot-roast'
import { computed } from 'vue'
import SettingsBody from './SettingsBody.vue'

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

const tabItems = [
  { label: '角色管理', value: 'character', icon: 'i-carbon-user-avatar' },
  { label: 'OpenAI 设置', value: 'openai', icon: 'i-carbon-api' },
  { label: '截图吐槽', value: 'roast', icon: 'i-carbon-chat' },
  { label: '目光跟踪', value: 'gaze', icon: 'i-carbon-view' },
]

const activeTabModel = computed({
  get: () => props.activeTab,
  set: value => emit('update:activeTab', value as typeof props.activeTab),
})

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

const tabsUi = {
  list: 'w-full gap-1 rounded-xl p-1',
  trigger: 'grow rounded-lg font-medium data-[state=active]:text-inverted',
  indicator: 'rounded-lg',
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
    :ui="{ content: 'max-w-xl' }"
    @update:open="handleModalOpenChange"
  >
    <template #content>
      <div class="flex max-h-[85vh] flex-col bg-default">
        <header class="flex items-center gap-3 px-5 pb-4 pt-5">
          <span class="flex size-9 items-center justify-center rounded-xl bg-primary text-inverted">
            <Icon name="i-carbon-settings" class="size-5" />
          </span>
          <h1 class="text-base font-semibold text-highlighted">
            设置
          </h1>
        </header>

        <div class="px-5 pb-1">
          <Tabs
            v-model="activeTabModel"
            :items="tabItems"
            :content="false"
            color="primary"
            variant="pill"
            size="sm"
            :ui="tabsUi"
          />
        </div>

        <main class="flex-1 overflow-auto px-5 py-4">
          <SettingsBody v-bind="bodyProps" v-on="bodyHandlers" />
        </main>

        <footer class="flex items-center justify-end gap-2 border-t border-default px-5 py-4">
          <Button color="neutral" variant="ghost" size="lg" @click="$emit('cancel')">
            取消
          </Button>
          <Button color="primary" size="lg" icon="i-carbon-checkmark" @click="$emit('save')">
            保存
          </Button>
        </footer>
      </div>
    </template>
  </Modal>

  <!-- 独立设置窗口形态 -->
  <div
    v-else-if="visible"
    class="flex h-screen w-screen flex-col bg-default"
    @keydown.stop
    @keyup.stop
    @keypress.stop
  >
    <header class="flex items-center gap-3 px-6 pb-4 pt-5">
      <span class="flex size-10 items-center justify-center rounded-xl bg-primary text-inverted">
        <Icon name="i-carbon-settings" class="size-5" />
      </span>
      <div class="min-w-0">
        <h1 class="text-base font-semibold leading-tight text-highlighted">
          NiNiSan 设置
        </h1>
        <p class="text-xs leading-tight text-muted">
          个性化你的桌面伙伴
        </p>
      </div>
    </header>

    <div class="px-6 pb-1">
      <Tabs
        v-model="activeTabModel"
        :items="tabItems"
        :content="false"
        color="primary"
        variant="pill"
        :ui="tabsUi"
      />
    </div>

    <main class="flex-1 overflow-auto px-6 py-5">
      <div class="mx-auto w-full max-w-2xl">
        <SettingsBody v-bind="bodyProps" v-on="bodyHandlers" />
      </div>
    </main>

    <footer class="flex items-center justify-end gap-2 border-t border-default px-6 py-4">
      <Button color="neutral" variant="ghost" size="lg" @click="$emit('cancel')">
        {{ cancelLabel }}
      </Button>
      <Button color="primary" size="lg" icon="i-carbon-checkmark" @click="$emit('save')">
        保存
      </Button>
    </footer>
  </div>
</template>
