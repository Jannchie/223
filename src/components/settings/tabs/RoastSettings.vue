<script setup lang="ts">
import type { RoastStyle } from '../../../utils/screenshot-prompts'
import type { RoastResult, ScreenshotRoastConfig } from '../../../utils/screenshot-roast'

defineProps<{
  roastConfig: ScreenshotRoastConfig
  isRoasting: boolean
  currentRoast: RoastResult | null
  roastHistory: RoastResult[]
}>()

const emit = defineEmits<{
  (e: 'toggleAuto'): void
  (e: 'setInterval', minutes: number): void
  (e: 'setStyle', style: RoastStyle): void
  (e: 'trigger'): void
  (e: 'clearHistory'): void
}>()
</script>

<template>
  <div class="tab-content">
    <h3>截图吐槽设置</h3>

    <div class="setting-item">
      <label>启用自动吐槽:</label>
      <button class="toggle-btn" :class="{ active: roastConfig.enabled }" @click="emit('toggleAuto')">
        {{ roastConfig.enabled ? '已开启' : '已关闭' }}
      </button>
    </div>

    <div class="setting-item">
      <label>吐槽间隔（分钟）:</label>
      <select :value="roastConfig.interval" class="setting-select" @change="emit('setInterval', Number(($event.target as HTMLSelectElement).value))">
        <option value="1">
          1 分钟
        </option>
        <option value="3">
          3 分钟
        </option>
        <option value="5">
          5 分钟
        </option>
        <option value="10">
          10 分钟
        </option>
        <option value="15">
          15 分钟
        </option>
        <option value="30">
          30 分钟
        </option>
        <option value="60">
          60 分钟
        </option>
      </select>
    </div>

    <div class="setting-item">
      <label>吐槽风格:</label>
      <select :value="roastConfig.style" class="setting-select" @change="emit('setStyle', ($event.target as HTMLSelectElement).value as RoastStyle)">
        <option value="default">
          默认 - 幽默风趣
        </option>
        <option value="gentle">
          温柔 - 温暖关怀
        </option>
        <option value="savage">
          毒舌 - 犀利直白
        </option>
        <option value="professional">
          专业 - 建设性建议
        </option>
      </select>
    </div>

    <div class="setting-item">
      <label>手动触发:</label>
      <div class="manual-trigger-group">
        <button class="action-btn" :disabled="isRoasting" @click="emit('trigger')">
          {{ isRoasting ? '正在吐槽...' : '立即吐槽' }}
        </button>
        <div class="hotkey-tip">
          <span class="hotkey-label">快捷键:</span>
          <kbd class="hotkey-kbd">F7</kbd>
        </div>
      </div>
    </div>

    <div v-if="currentRoast" class="current-roast">
      <h4>最新吐槽</h4>
      <div class="roast-content">
        {{ currentRoast.text }}
      </div>
      <div class="roast-time">
        {{ new Date(currentRoast.timestamp).toLocaleString() }}
      </div>
    </div>

    <div v-if="roastHistory.length > 0" class="roast-history">
      <div class="history-header">
        <h4>历史记录</h4>
        <button class="clear-btn" @click="emit('clearHistory')">
          清空
        </button>
      </div>
      <div class="history-list">
        <div v-for="roast in roastHistory.slice(0, 5)" :key="roast.timestamp" class="history-item">
          <div class="history-content">
            {{ roast.text }}
          </div>
          <div class="history-time">
            {{ new Date(roast.timestamp).toLocaleString() }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tab-content { padding: 4px 2px; }
.setting-item { display: flex; align-items: center; gap: 12px; margin: 12px 0; }
label { width: 110px; color: #444; }
.toggle-btn { padding: 8px 12px; border: 1px solid #ddd; border-radius: 8px; background: #f8f9fa; cursor: pointer; }
.toggle-btn.active { border-color: #28a745; background: linear-gradient(135deg, #28a745, #20c997); color: white; }
.setting-select { padding: 8px 12px; border: 1px solid #ddd; border-radius: 8px; background: white; }
.action-btn { padding: 10px 20px; border: none; border-radius: 8px; background: linear-gradient(135deg, #ff6b6b, #feca57); color: white; cursor: pointer; }
.manual-trigger-group { display: flex; align-items: center; gap: 16px; }
.hotkey-kbd { padding: 4px 8px; background: #eee; border: 1px solid #ddd; border-radius: 4px; font-family: monospace; }
.current-roast { margin-top: 20px; padding: 16px; background: rgba(255, 107, 107, 0.1); border: 1px solid rgba(255, 107, 107, 0.3); border-radius: 12px; }
.roast-content { background: rgba(255, 255, 255, 0.9); padding: 12px; border-radius: 8px; margin-bottom: 8px; color: #333; }
.roast-time { font-size: 12px; color: #666; text-align: right; }
.roast-history { margin-top: 20px; max-height: 200px; overflow-y: auto; }
.history-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.clear-btn { padding: 6px 12px; border: 1px solid #dc3545; border-radius: 6px; background: transparent; color: #dc3545; cursor: pointer; }
.history-item { padding: 8px 12px; margin-bottom: 8px; background: rgba(0,0,0,.03); border-radius: 8px; border-left: 3px solid #ff6b6b; }
.history-time { font-size: 11px; color: #999; text-align: right; }
</style>
