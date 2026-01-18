<script setup lang="ts">
import type { RoastStyle } from '../../utils/screenshot-prompts'
import type { RoastResult, ScreenshotRoastConfig } from '../../utils/screenshot-roast'
import { computed } from 'vue'
import CharacterSettings from './tabs/CharacterSettings.vue'
import GazeSettings from './tabs/GazeSettings.vue'
import OpenAISettings from './tabs/OpenAISettings.vue'
import RoastSettings from './tabs/RoastSettings.vue'

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
  gazeAtUserConfig: any
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
  (e: 'gazeUpdateConfig', cfg: any): void
  (e: 'gazeTestLock'): void
}>()

const tabItems = [
  { label: '角色管理', value: 'character', icon: 'i-carbon-user' },
  { label: 'OpenAI 设置', value: 'openai', icon: 'i-carbon-application' },
  { label: '截图吐槽', value: 'roast', icon: 'i-carbon-chat' },
  { label: '目光跟踪', value: 'gaze', icon: 'i-carbon-view' },
]

const activeTabModel = computed({
  get: () => props.activeTab,
  set: value => emit('update:activeTab', value as typeof props.activeTab),
})

const cancelLabel = computed(() => (props.embedded ? '关闭' : '取消'))

function handleModalOpenChange(open: boolean) {
  if (!open) {
    emit('cancel')
  }
}
</script>

<template>
  <UModal
    v-if="!embedded"
    :open="visible"
    :close="false"
    @update:open="handleModalOpenChange"
  >
    <template #content>
      <UCard>
        <UTabs v-model="activeTabModel" :items="tabItems">
          <template #content="{ item }">
            <div class="p-4 space-y-4">
              <CharacterSettings
                v-if="item.value === 'character'"
                :current-character-id="currentCharacterId"
                :refresh-key="characterRefreshKey ?? 0"
                @select="e => emit('characterSelect', e)"
                @edit="e => emit('characterEdit', e)"
                @delete="e => emit('characterDelete', e)"
                @create="() => emit('characterCreate')"
              />

              <OpenAISettings
                v-else-if="item.value === 'openai'"
                :api-key="apiKey"
                :base-u-r-l="baseURL"
                @update:api-key="v => emit('update:apiKey', v)"
                @update:base-u-r-l="v => emit('update:baseURL', v)"
              />

              <RoastSettings
                v-else-if="item.value === 'roast'"
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
            </div>
          </template>
        </UTabs>

        <template #footer>
          <div class="flex gap-2 justify-end">
            <UButton color="primary" @click="$emit('save')">
              保存
            </UButton>
            <UButton color="neutral" variant="ghost" @click="$emit('cancel')">
              取消
            </UButton>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>

  <div
    v-else-if="visible"
    class="h-screen w-screen"
    @keydown.stop
    @keyup.stop
    @keypress.stop
  >
    <UCard
      class="rounded-none flex flex-col h-full w-full"
      :ui="{ body: 'flex-1 overflow-auto', footer: 'mt-auto' }"
    >
      <UTabs v-model="activeTabModel" :items="tabItems">
        <template #content="{ item }">
          <div class="p-4 space-y-4">
            <CharacterSettings
              v-if="item.value === 'character'"
              :current-character-id="currentCharacterId"
              :refresh-key="characterRefreshKey ?? 0"
              @select="e => emit('characterSelect', e)"
              @edit="e => emit('characterEdit', e)"
              @delete="e => emit('characterDelete', e)"
              @create="() => emit('characterCreate')"
            />

            <OpenAISettings
              v-else-if="item.value === 'openai'"
              :api-key="apiKey"
              :base-u-r-l="baseURL"
              @update:api-key="v => emit('update:apiKey', v)"
              @update:base-u-r-l="v => emit('update:baseURL', v)"
            />

            <RoastSettings
              v-else-if="item.value === 'roast'"
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
          </div>
        </template>
      </UTabs>

      <template #footer>
        <div class="flex gap-2 justify-end">
          <UButton color="primary" @click="$emit('save')">
            保存
          </UButton>
          <UButton color="neutral" variant="ghost" @click="$emit('cancel')">
            {{ cancelLabel }}
          </UButton>
        </div>
      </template>
    </UCard>
  </div>
</template>
