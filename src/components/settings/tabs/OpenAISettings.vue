<script setup lang="ts">
defineProps<{ apiKey: string, baseURL: string }>()
const emit = defineEmits<{ (e: 'update:apiKey', v: string): void, (e: 'update:baseURL', v: string): void }>()
</script>

<template>
  <div class="tab-content">
    <h3>OpenAI 设置</h3>
    <div class="setting-item">
      <label>API Key:</label>
      <input
        :value="apiKey"
        type="password"
        placeholder="输入你的 OpenAI API Key"
        class="setting-input"
        @input="emit('update:apiKey', ($event.target as HTMLInputElement).value)"
      >
    </div>
    <div class="setting-item">
      <label>Base URL:</label>
      <input
        :value="baseURL"
        type="text"
        placeholder="API 基础地址"
        class="setting-input"
        @input="emit('update:baseURL', ($event.target as HTMLInputElement).value)"
      >
    </div>
  </div>
</template>

<style scoped>
.tab-content { padding: 4px 2px; }
.setting-item { display: flex; align-items: center; gap: 12px; margin: 12px 0; }
label { width: 96px; color: #444; }
.setting-input { flex: 1; padding: 8px 12px; border: 1px solid #ddd; border-radius: 8px; color: #0f172a; background: #fff; }
.setting-input::placeholder { color: #64748b; }
.setting-input:focus { outline: none; border-color: #007bff; box-shadow: 0 0 0 2px rgba(0,123,255,.2); }
</style>
