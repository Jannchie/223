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
  <div class="space-y-4">
    <UFormField label="自动吐槽">
      <USwitch
        :model-value="roastConfig.enabled"
        @update:model-value="() => emit('toggleAuto')"
      />
    </UFormField>

    <UFormField label="吐槽间隔">
      <USelect
        :model-value="roastConfig.interval"
        :items="intervalOptions"
        @update:model-value="updateInterval"
      />
    </UFormField>

    <UFormField label="吐槽风格">
      <USelect
        :model-value="roastConfig.style"
        :items="styleOptions"
        @update:model-value="updateStyle"
      />
    </UFormField>

    <UCard variant="soft">
      <template #header>
        <div class="font-medium">
          手动触发
        </div>
      </template>
      <div class="flex items-center gap-3">
        <UButton :loading="isRoasting" color="primary" @click="emit('trigger')">
          {{ isRoasting ? '正在吐槽...' : '立即吐槽' }}
        </UButton>
        <div class="flex items-center gap-2">
          <span>快捷键</span>
          <UKbd value="F7" />
        </div>
      </div>
    </UCard>

    <UAlert
      v-if="currentRoast"
      title="最新吐槽"
      :description="currentRoast.text"
      color="warning"
      variant="soft"
    >
      <template #actions>
        <span>{{ new Date(currentRoast.timestamp).toLocaleString() }}</span>
      </template>
    </UAlert>

    <UCard v-if="roastHistory.length > 0" variant="soft">
      <template #header>
        <div class="flex items-center justify-between">
          <div class="font-medium">
            吐槽历史
          </div>
          <UButton color="neutral" variant="ghost" size="xs" @click="emit('clearHistory')">
            清空
          </UButton>
        </div>
      </template>
      <div class="space-y-2">
        <div v-for="roast in roastHistory.slice(0, 5)" :key="roast.timestamp">
          <div>
            {{ roast.text }}
          </div>
          <div>
            {{ new Date(roast.timestamp).toLocaleString() }}
          </div>
        </div>
      </div>
    </UCard>
  </div>
</template>
