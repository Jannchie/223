<script setup lang="ts">
const { gazeConfig, model } = defineProps<{ gazeConfig: any, model: any | null }>()
const emit = defineEmits<{ (e: 'updateConfig', cfg: any): void, (e: 'testLock'): void }>()
</script>

<template>
  <div class="tab-content">
    <h3>目光跟踪设置</h3>
    <div class="setting-item">
      <label>定期目光锁定:</label>
      <button class="toggle-btn" :class="{ active: gazeConfig.enabled }" @click="emit('updateConfig', { enabled: !gazeConfig.enabled })">
        {{ gazeConfig.enabled ? '已开启' : '已关闭' }}
      </button>
      <p class="setting-description">
        角色会定期看向用户，增加互动感
      </p>
    </div>

    <div class="setting-item">
      <label>锁定间隔（分钟）:</label>
      <select :value="gazeConfig.intervalMinutes" class="setting-select" :disabled="!gazeConfig.enabled" @change="emit('updateConfig', { intervalMinutes: Number(($event.target as HTMLSelectElement).value) })">
        <option value="0.5">
          30 秒
        </option>
        <option value="1">
          1 分钟
        </option>
        <option value="2">
          2 分钟
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
      </select>
    </div>

    <div class="setting-item">
      <label>锁定持续时间（秒）:</label>
      <select :value="gazeConfig.lockDurationSeconds" class="setting-select" :disabled="!gazeConfig.enabled" @change="emit('updateConfig', { lockDurationSeconds: Number(($event.target as HTMLSelectElement).value) })">
        <option value="1">
          1 秒
        </option>
        <option value="2">
          2 秒
        </option>
        <option value="3">
          3 秒
        </option>
        <option value="5">
          5 秒
        </option>
        <option value="7">
          7 秒
        </option>
        <option value="10">
          10 秒
        </option>
      </select>
    </div>

    <div class="setting-item">
      <label>随机化间隔时间:</label>
      <button class="toggle-btn" :class="{ active: gazeConfig.randomizeInterval }" :disabled="!gazeConfig.enabled" @click="emit('updateConfig', { randomizeInterval: !gazeConfig.randomizeInterval })">
        {{ gazeConfig.randomizeInterval ? '已开启' : '已关闭' }}
      </button>
      <p class="setting-description">
        在设定间隔的 50%-150% 之间随机变化，让行为更自然
      </p>
    </div>

    <div class="setting-item">
      <label>随机化锁定时间:</label>
      <button class="toggle-btn" :class="{ active: gazeConfig.randomizeDuration }" :disabled="!gazeConfig.enabled" @click="emit('updateConfig', { randomizeDuration: !gazeConfig.randomizeDuration })">
        {{ gazeConfig.randomizeDuration ? '已开启' : '已关闭' }}
      </button>
      <p class="setting-description">
        在设定时长的 70%-130% 之间随机变化，避免过于规律
      </p>
    </div>

    <div class="setting-item">
      <label>当前状态:</label>
      <div class="status-display">
        <span v-if="!model" class="status-indicator">模型未加载</span>
        <span v-else-if="!(model as any).setEyesAlwaysLookAtCamera" class="status-indicator warning">模型不支持眼睛锁定</span>
        <span class="status-indicator">等待中</span>
      </div>
    </div>

    <div class="setting-item">
      <label>测试功能:</label>
      <button class="action-btn" :disabled="!model || !(model as any).setEyesAlwaysLookAtCamera || !gazeConfig.enabled" @click="emit('testLock')">
        立即测试锁定
      </button>
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
.setting-description { margin: 4px 0 0 0; font-size: 12px; color: #666; line-height: 1.3; }
.status-display { display: flex; flex-wrap: wrap; gap: 8px; }
.status-indicator { display: inline-block; padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: 500; background: #f0f0f0; color: #666; }
.status-indicator.warning { background: linear-gradient(135deg, #ffc107, #fd7e14); color: white; }
.action-btn { padding: 10px 20px; border: none; border-radius: 8px; background: linear-gradient(135deg, #ff6b6b, #feca57); color: white; cursor: pointer; }
</style>
