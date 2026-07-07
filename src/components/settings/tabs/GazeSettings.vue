<script setup lang="ts">
import type { GazeAtUserConfig, GazeAtUserConfigUpdate } from '../../../composables/useGaze'
import SettingsGroup from '../SettingsGroup.vue'
import SettingsRow from '../SettingsRow.vue'

defineProps<{ gazeConfig: GazeAtUserConfig }>()
const emit = defineEmits<{ (e: 'updateConfig', cfg: GazeAtUserConfigUpdate): void, (e: 'testLock'): void }>()

const intervalOptions = [
  { label: '30 秒', value: 0.5 },
  { label: '1 分钟', value: 1 },
  { label: '2 分钟', value: 2 },
  { label: '3 分钟', value: 3 },
  { label: '5 分钟', value: 5 },
  { label: '10 分钟', value: 10 },
]

const durationOptions = [
  { label: '1 秒', value: 1 },
  { label: '2 秒', value: 2 },
  { label: '3 秒', value: 3 },
  { label: '5 秒', value: 5 },
  { label: '7 秒', value: 7 },
  { label: '10 秒', value: 10 },
]

function updateConfig(cfg: GazeAtUserConfigUpdate) {
  emit('updateConfig', cfg)
}

function updateEnabled(value: unknown) {
  updateConfig({ enabled: Boolean(value) })
}

function updateIntervalMinutes(value: unknown) {
  updateConfig({ intervalMinutes: Number(value) })
}

function updateLockDurationSeconds(value: unknown) {
  updateConfig({ lockDurationSeconds: Number(value) })
}

function updateRandomizeInterval(value: unknown) {
  updateConfig({ randomizeInterval: Boolean(value) })
}

function updateRandomizeDuration(value: unknown) {
  updateConfig({ randomizeDuration: Boolean(value) })
}
</script>

<template>
  <div class="space-y-4">
    <!-- 总开关 -->
    <SettingsGroup>
      <SettingsRow
        icon="i-carbon-view"
        label="启用目光锁定"
        description="定时让角色看向你，增加陪伴感"
      >
        <Switch
          :model-value="gazeConfig.enabled"
          @update:model-value="updateEnabled"
        />
      </SettingsRow>
    </SettingsGroup>

    <!-- 细节配置 -->
    <SettingsGroup :dimmed="!gazeConfig.enabled">
      <SettingsRow label="锁定间隔" description="每隔多久看你一次">
        <Select
          :model-value="gazeConfig.intervalMinutes"
          :items="intervalOptions"
          :disabled="!gazeConfig.enabled"
          class="min-w-32"
          @update:model-value="updateIntervalMinutes"
        />
      </SettingsRow>

      <SettingsRow label="锁定时长" description="每次注视持续多久">
        <Select
          :model-value="gazeConfig.lockDurationSeconds"
          :items="durationOptions"
          :disabled="!gazeConfig.enabled"
          class="min-w-32"
          @update:model-value="updateLockDurationSeconds"
        />
      </SettingsRow>

      <SettingsRow label="间隔随机化" description="在基准值 50%-150% 范围内随机">
        <Switch
          :model-value="gazeConfig.randomizeInterval"
          :disabled="!gazeConfig.enabled"
          @update:model-value="updateRandomizeInterval"
        />
      </SettingsRow>

      <SettingsRow label="时长随机化" description="在基准值 70%-130% 范围内随机">
        <Switch
          :model-value="gazeConfig.randomizeDuration"
          :disabled="!gazeConfig.enabled"
          @update:model-value="updateRandomizeDuration"
        />
      </SettingsRow>
    </SettingsGroup>

    <Button
      :disabled="!gazeConfig.enabled"
      color="primary"
      variant="soft"
      icon="i-carbon-view"
      block
      @click="emit('testLock')"
    >
      测试锁定
    </Button>
  </div>
</template>
