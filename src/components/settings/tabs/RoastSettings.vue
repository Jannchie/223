<script setup lang="ts">
import type { RoastStyle } from '../../../utils/screenshot-prompts'
import type { RoastResult, ScreenshotRoastConfig } from '../../../utils/screenshot-roast'
import SettingsGroup from '../SettingsGroup.vue'
import SettingsRow from '../SettingsRow.vue'

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

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleString()
}
</script>

<template>
  <div class="space-y-4">
    <!-- 总开关 -->
    <SettingsGroup>
      <SettingsRow
        icon="i-carbon-camera"
        label="自动吐槽"
        description="按设定间隔自动截图并生成吐槽"
      >
        <Switch
          :model-value="roastConfig.enabled"
          @update:model-value="() => emit('toggleAuto')"
        />
      </SettingsRow>
    </SettingsGroup>

    <!-- 细节配置 -->
    <SettingsGroup>
      <SettingsRow
        label="吐槽间隔"
        description="自动吐槽的触发频率"
        :dimmed="!roastConfig.enabled"
      >
        <Select
          :model-value="roastConfig.interval"
          :items="intervalOptions"
          :disabled="!roastConfig.enabled"
          class="min-w-32"
          @update:model-value="updateInterval"
        />
      </SettingsRow>

      <SettingsRow label="吐槽风格" description="同时作用于自动与手动吐槽">
        <Select
          :model-value="roastConfig.style"
          :items="styleOptions"
          class="min-w-44"
          @update:model-value="updateStyle"
        />
      </SettingsRow>
    </SettingsGroup>

    <!-- 手动触发 -->
    <SettingsGroup>
      <div class="flex items-center gap-3 p-4">
        <Button
          :loading="isRoasting"
          color="primary"
          icon="i-carbon-camera"
          @click="emit('trigger')"
        >
          {{ isRoasting ? '正在吐槽...' : '立即吐槽' }}
        </Button>
        <div class="ml-auto flex items-center gap-2 text-sm text-muted">
          <span>快捷键</span>
          <Kbd value="F7" />
        </div>
      </div>
    </SettingsGroup>

    <!-- 最新吐槽 -->
    <SettingsGroup v-if="currentRoast">
      <div class="p-4">
        <div class="mb-2 flex items-center gap-2">
          <Icon name="i-carbon-chat" class="size-4 text-primary" />
          <p class="text-sm font-medium text-highlighted">
            最新吐槽
          </p>
          <span class="ml-auto text-xs text-dimmed">
            {{ formatTime(currentRoast.timestamp) }}
          </span>
        </div>
        <p class="text-sm leading-relaxed text-default">
          {{ currentRoast.text }}
        </p>
      </div>
    </SettingsGroup>

    <!-- 历史 -->
    <div v-if="roastHistory.length > 0" class="space-y-2">
      <div class="flex items-center justify-between px-1">
        <p class="text-sm font-medium text-highlighted">
          吐槽历史
        </p>
        <Button
          color="neutral"
          variant="ghost"
          size="xs"
          icon="i-carbon-trash-can"
          @click="emit('clearHistory')"
        >
          清空
        </Button>
      </div>
      <div class="space-y-2">
        <div
          v-for="roast in roastHistory.slice(0, 5)"
          :key="roast.timestamp"
          class="rounded-xl border border-default bg-elevated p-3"
        >
          <p class="text-sm leading-relaxed text-default">
            {{ roast.text }}
          </p>
          <p class="mt-1.5 text-xs text-dimmed">
            {{ formatTime(roast.timestamp) }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
