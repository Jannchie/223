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

const intervalOptions = [
  { label: '1 分钟', value: 1 },
  { label: '3 分钟', value: 3 },
  { label: '5 分钟', value: 5 },
  { label: '10 分钟', value: 10 },
  { label: '15 分钟', value: 15 },
  { label: '30 分钟', value: 30 },
  { label: '60 分钟', value: 60 },
]

const styleOptions = [
  { label: '默认 - 轻松吐槽', value: 'default' },
  { label: '温柔 - 贴心鼓励', value: 'gentle' },
  { label: '毒舌 - 锐利吐槽', value: 'savage' },
  { label: '专业 - 建设性建议', value: 'professional' },
]
function updateInterval(value: unknown) {
  emit('setInterval', Number(value))
}

function updateStyle(value: unknown) {
  emit('setStyle', value as RoastStyle)
}
</script>

<template>
  <div class="space-y-5">
    <div class="rounded-xl border border-default divide-y divide-default">
      <UFormField
        label="自动吐槽"
        description="按设定间隔自动截图并生成吐槽"
        class="flex items-center justify-between p-4"
      >
        <USwitch
          :model-value="roastConfig.enabled"
          @update:model-value="() => emit('toggleAuto')"
        />
      </UFormField>

      <UFormField label="吐槽间隔" class="flex items-center justify-between gap-4 p-4">
        <USelect
          :model-value="roastConfig.interval"
          :items="intervalOptions"
          :disabled="!roastConfig.enabled"
          class="min-w-32"
          @update:model-value="updateInterval"
        />
      </UFormField>

      <UFormField label="吐槽风格" class="flex items-center justify-between gap-4 p-4">
        <USelect
          :model-value="roastConfig.style"
          :items="styleOptions"
          class="min-w-44"
          @update:model-value="updateStyle"
        />
      </UFormField>
    </div>

    <div class="flex items-center gap-3 rounded-xl border border-default bg-elevated/40 p-4">
      <UButton
        :loading="isRoasting"
        color="primary"
        icon="i-carbon-camera"
        @click="emit('trigger')"
      >
        {{ isRoasting ? '正在吐槽...' : '立即吐槽' }}
      </UButton>
      <div class="ml-auto flex items-center gap-2 text-sm text-muted">
        <span>快捷键</span>
        <UKbd value="F7" />
      </div>
    </div>

    <UAlert
      v-if="currentRoast"
      icon="i-carbon-chat"
      title="最新吐槽"
      :description="currentRoast.text"
      color="warning"
      variant="soft"
    >
      <template #actions>
        <span class="text-xs text-muted">{{ new Date(currentRoast.timestamp).toLocaleString() }}</span>
      </template>
    </UAlert>

    <div v-if="roastHistory.length > 0" class="space-y-2">
      <div class="flex items-center justify-between px-1">
        <p class="text-sm font-medium text-highlighted">
          吐槽历史
        </p>
        <UButton
          color="neutral"
          variant="ghost"
          size="xs"
          icon="i-carbon-trash-can"
          @click="emit('clearHistory')"
        >
          清空
        </UButton>
      </div>
      <div class="space-y-2">
        <div
          v-for="roast in roastHistory.slice(0, 5)"
          :key="roast.timestamp"
          class="rounded-lg border border-default bg-elevated/40 p-3"
        >
          <p class="text-sm text-default leading-relaxed">
            {{ roast.text }}
          </p>
          <p class="mt-1.5 text-xs text-muted">
            {{ new Date(roast.timestamp).toLocaleString() }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
