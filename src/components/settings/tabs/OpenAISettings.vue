<script setup lang="ts">
defineProps<{ apiKey: string, baseURL: string }>()
const emit = defineEmits<{ (e: 'update:apiKey', v: string): void, (e: 'update:baseURL', v: string): void }>()

function updateApiKey(value: unknown) {
  emit('update:apiKey', String(value ?? ''))
}

function updateBaseURL(value: unknown) {
  emit('update:baseURL', String(value ?? ''))
}
</script>

<template>
  <div class="space-y-4">
    <UFormField label="API Key" required>
      <UInput
        :model-value="apiKey"
        type="password"
        placeholder="请输入 OpenAI API Key"
        autocomplete="off"
        @update:model-value="updateApiKey"
      />
    </UFormField>

    <UFormField label="Base URL">
      <UInput
        :model-value="baseURL"
        type="text"
        placeholder="API 基础地址"
        @update:model-value="updateBaseURL"
      />
    </UFormField>
  </div>
</template>
