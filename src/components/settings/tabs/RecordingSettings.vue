<script setup lang="ts">
defineProps<{ isRecordingWindowOpen: boolean }>()
const emit = defineEmits<{ (e: 'toggleRecordingWindow'): void }>()
</script>

<template>
  <div class="tab-content">
    <h3>录制窗口设置</h3>
    <div class="setting-item">
      <label>录制窗口:</label>
      <div class="recording-mode-info">
        <p class="mode-description">
          {{ isRecordingWindowOpen ? '录制窗口已打开，可供OBS等录制软件捕获' : '录制窗口已关闭' }}
        </p>
        <button class="toggle-btn" :class="{ active: isRecordingWindowOpen }" @click="emit('toggleRecordingWindow')">
          {{ isRecordingWindowOpen ? '关闭录制窗口' : '打开录制窗口' }}
        </button>
      </div>
    </div>

    <div class="setting-item">
      <div class="recording-tips">
        <h4>使用说明:</h4>
        <ul>
          <li>主窗口：保持透明，适合日常使用和交互</li>
          <li>录制窗口：独立窗口，带有背景色，专供录制软件捕获</li>
          <li>两个窗口显示相同的Live2D角色，互不干扰</li>
          <li>可以同时使用主窗口进行交互，用录制窗口进行直播/录制</li>
          <li>也可通过系统托盘右键菜单快速操作</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tab-content { padding: 4px 2px; }
.setting-item { margin: 12px 0; }
.recording-mode-info { display: flex; flex-direction: column; gap: 12px; padding: 16px; background: rgba(0,123,255,0.05); border-radius: 12px; border: 1px solid rgba(0,123,255,0.1); }
.mode-description { margin: 0; font-size: 14px; color: #555; }
.toggle-btn { padding: 8px 12px; border: 1px solid #ddd; border-radius: 8px; background: #f8f9fa; cursor: pointer; }
.toggle-btn.active { border-color: #28a745; background: linear-gradient(135deg, #28a745, #20c997); color: white; }
.recording-tips { padding: 16px; background: rgba(255,235,59,0.05); border-radius: 8px; border-left: 4px solid #ffc107; }
.recording-tips h4 { margin: 0 0 12px 0; font-size: 14px; color: #333; font-weight: 600; }
.recording-tips ul { margin: 0; padding-left: 20px; }
.recording-tips li { font-size: 13px; color: #666; line-height: 1.4; margin-bottom: 6px; }
</style>
