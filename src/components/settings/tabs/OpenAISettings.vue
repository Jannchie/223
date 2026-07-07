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
  <div class="space-y-5">
    <UFormField
      label="API Key"
      description="密钥仅保存在本地，不会上传到任何服务器"
      required
    >
      <UInput
        :model-value="apiKey"
        type="password"
        placeholder="sk-..."
        autocomplete="off"
        icon="i-carbon-password"
        size="lg"
        class="w-full"
        @update:model-value="updateApiKey"
      />
    </UFormField>

    <UFormField
      label="Base URL"
      description="兼容 OpenAI 协议的服务地址，留空则使用官方接口"
    >
      <UInput
        :model-value="baseURL"
        type="text"
        placeholder="https://api.openai.com/v1"
        icon="i-carbon-link"
        size="lg"
        class="w-full"
        @update:model-value="updateBaseURL"
      />
    </UFormField>

    <UAlert
      color="neutral"
      variant="soft"
      icon="i-carbon-information"
      title="如何获取 API Key？"
      description="前往 OpenAI 平台或任意兼容服务商创建密钥，粘贴到上方即可开始聊天。"
    />
  </div>
</template>
