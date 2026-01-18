<script setup lang="ts">
defineProps<{ isRecordingWindowOpen: boolean }>()
const emit = defineEmits<{ (e: 'toggleRecordingWindow'): void }>()
</script>

<template>
  <div class="space-y-4">
    <UCard variant="soft">
      <template #header>
        <div class="font-medium">录制窗口</div>
      </template>

      <p>
        {{ isRecordingWindowOpen
          ? '当前处于录制窗口模式，可用于 OBS 采集透明背景'
          : '开启录制窗口后会打开独立窗口，便于 OBS 采集' }}
      </p>

      <UButton
        :color="isRecordingWindowOpen ? 'primary' : 'neutral'"
        :variant="isRecordingWindowOpen ? 'solid' : 'outline'"
        @click="emit('toggleRecordingWindow')"
      >
        {{ isRecordingWindowOpen ? '关闭录制窗口' : '打开录制窗口' }}
      </UButton>
    </UCard>

    <UCard variant="soft">
      <template #header>
        <div class="font-medium">使用提示</div>
      </template>
      <ul class="list-disc pl-5 space-y-1">
        <li>录制窗口只显示角色画面，方便在 OBS 中抠透明背景</li>
        <li>可在主窗口调整角色位置与缩放，录制窗口会同步</li>
        <li>录制窗口支持独立拖拽与缩放，按需设置尺寸</li>
        <li>建议在 OBS 中使用“窗口捕获/游戏捕获”进行录制</li>
        <li>关闭录制窗口不会影响主窗口运行</li>
      </ul>
    </UCard>
  </div>
</template>
