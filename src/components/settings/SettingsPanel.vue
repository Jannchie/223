<script setup lang="ts">
import type { RoastStyle } from '../../utils/screenshot-prompts'
import type { RoastResult, ScreenshotRoastConfig } from '../../utils/screenshot-roast'
import CharacterSettings from './tabs/CharacterSettings.vue'
import GazeSettings from './tabs/GazeSettings.vue'
import OpenAISettings from './tabs/OpenAISettings.vue'
import RecordingSettings from './tabs/RecordingSettings.vue'
import RoastSettings from './tabs/RoastSettings.vue'

defineProps<{
  visible: boolean
  embedded?: boolean
  activeTab: 'openai' | 'character' | 'roast' | 'recording' | 'gaze'
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
  // Recording
  isRecordingWindowOpen: boolean
  // Gaze
  gazeAtUserConfig: any
  model: any | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'cancel'): void
  (e: 'save'): void
  (e: 'update:activeTab', tab: 'openai' | 'character' | 'roast' | 'recording' | 'gaze'): void
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
  // Recording
  (e: 'recordingToggle'): void
  // Gaze
  (e: 'gazeUpdateConfig', cfg: any): void
  (e: 'gazeTestLock'): void
}>()

function switchTab(tab: 'openai' | 'character' | 'roast' | 'recording' | 'gaze') {
  emit('update:activeTab', tab)
}

function onOverlayClick() {
  emit('cancel')
}
</script>

<template>
  <teleport v-if="!embedded" to="body">
    <div v-if="visible" class="settings-overlay" @click="onOverlayClick">
      <div class="settings-panel" @click.stop @keydown.stop @keyup.stop @keypress.stop>
        <!-- tabs -->
        <div class="settings-tabs">
          <button class="tab-button" :class="{ active: activeTab === 'character' }" @click="switchTab('character')">
            角色管理
          </button>
          <button class="tab-button" :class="{ active: activeTab === 'openai' }" @click="switchTab('openai')">
            OpenAI 设置
          </button>
          <button class="tab-button" :class="{ active: activeTab === 'roast' }" @click="switchTab('roast')">
            截图吐槽
          </button>
          <button class="tab-button" :class="{ active: activeTab === 'recording' }" @click="switchTab('recording')">
            录制窗口
          </button>
          <button class="tab-button" :class="{ active: activeTab === 'gaze' }" @click="switchTab('gaze')">
            目光跟踪
          </button>
        </div>

        <div class="tab-body">
          <CharacterSettings
            v-if="activeTab === 'character'"
            :current-character-id="currentCharacterId"
            :refresh-key="characterRefreshKey ?? 0"
            @select="e => emit('characterSelect', e)"
            @edit="e => emit('characterEdit', e)"
            @delete="e => emit('characterDelete', e)"
            @create="() => emit('characterCreate')"
          />

          <OpenAISettings
            v-else-if="activeTab === 'openai'"
            :api-key="apiKey"
            :base-u-r-l="baseURL"
            @update:api-key="v => emit('update:apiKey', v)"
            @update:base-u-r-l="v => emit('update:baseURL', v)"
          />

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

          <RecordingSettings
            v-else-if="activeTab === 'recording'"
            :is-recording-window-open="isRecordingWindowOpen"
            @toggle-recording-window="() => emit('recordingToggle')"
          />

          <GazeSettings
            v-else
            :gaze-config="gazeAtUserConfig"
            :model="model"
            @update-config="cfg => emit('gazeUpdateConfig', cfg)"
            @test-lock="() => emit('gazeTestLock')"
          />
        </div>

        <div class="setting-actions">
          <button class="save-btn" @click="$emit('save')">
            保存
          </button>
          <button class="cancel-btn" @click="$emit('cancel')">
            取消
          </button>
        </div>
      </div>
    </div>
  </teleport>

  <div v-else-if="visible" class="settings-window" @keydown.stop @keyup.stop @keypress.stop>
    <div class="settings-panel">
      <!-- tabs -->
      <div class="settings-tabs">
        <button class="tab-button" :class="{ active: activeTab === 'character' }" @click="switchTab('character')">
          角色管理
        </button>
        <button class="tab-button" :class="{ active: activeTab === 'openai' }" @click="switchTab('openai')">
          OpenAI 设置
        </button>
        <button class="tab-button" :class="{ active: activeTab === 'roast' }" @click="switchTab('roast')">
          截图吐槽
        </button>
        <button class="tab-button" :class="{ active: activeTab === 'recording' }" @click="switchTab('recording')">
          录制窗口
        </button>
        <button class="tab-button" :class="{ active: activeTab === 'gaze' }" @click="switchTab('gaze')">
          目光跟踪
        </button>
      </div>

      <div class="tab-body">
        <CharacterSettings
          v-if="activeTab === 'character'"
          :current-character-id="currentCharacterId"
          :refresh-key="characterRefreshKey ?? 0"
          @select="e => emit('characterSelect', e)"
          @edit="e => emit('characterEdit', e)"
          @delete="e => emit('characterDelete', e)"
          @create="() => emit('characterCreate')"
        />

        <OpenAISettings
          v-else-if="activeTab === 'openai'"
          :api-key="apiKey"
          :base-u-r-l="baseURL"
          @update:api-key="v => emit('update:apiKey', v)"
          @update:base-u-r-l="v => emit('update:baseURL', v)"
        />

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

        <RecordingSettings
          v-else-if="activeTab === 'recording'"
          :is-recording-window-open="isRecordingWindowOpen"
          @toggle-recording-window="() => emit('recordingToggle')"
        />

        <GazeSettings
          v-else
          :gaze-config="gazeAtUserConfig"
          :model="model"
          @update-config="cfg => emit('gazeUpdateConfig', cfg)"
          @test-lock="() => emit('gazeTestLock')"
        />
      </div>

      <div class="setting-actions">
        <button class="save-btn" @click="$emit('save')">
          保存
        </button>
        <button class="cancel-btn" @click="$emit('cancel')">
          关闭
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Settings overlay/panel and common controls (moved from viewer) */
.settings-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  z-index: 10000;
  display: flex;
  justify-content: center;
  align-items: center;
  -webkit-app-region: no-drag;
  pointer-events: auto;
}

.settings-panel {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 12px;
  padding: 0;
  min-width: 400px;
  max-width: 500px;
  min-height: 500px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  pointer-events: auto;
  max-height: 85vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.settings-window {
  width: 100vw;
  height: 100vh;
  background: #f5f6f8;
  display: flex;
  align-items: stretch;
  justify-content: stretch;
}

.settings-window .settings-panel {
  width: 100%;
  max-width: none;
  height: 100%;
  border-radius: 0;
  box-shadow: none;
  background: #fff;
}

.settings-tabs {
  display: flex;
  border-bottom: 1px solid #e0e0e0;
  background: #f8f9fa;
  border-radius: 12px 12px 0 0;
}

.tab-button {
  flex: 1;
  padding: 16px 20px;
  border: none;
  background: transparent;
  color: #666;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 12px 12px 0 0;
}

.tab-button.active {
  color: #222;
  background: white;
  border-bottom: 2px solid #007bff;
}

.tab-body {
  padding: 16px 20px 0 20px;
  flex: 1;
  overflow: auto;
}

.setting-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid #eee;
  background: #fff;
}

.save-btn, .cancel-btn {
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid #ddd;
  background: #f8f9fa;
  cursor: pointer;
}

.save-btn {
  border-color: #28a745;
  background: linear-gradient(135deg, #28a745, #20c997);
  color: white;
}

.save-btn:hover {
  filter: brightness(1.05);
}

.cancel-btn:hover {
  background: #f1f3f5;
}

@media (max-width: 600px) {
  .settings-panel { margin: 20px; min-width: auto; width: calc(100% - 40px); }
}
</style>
