<script setup lang="ts">
withDefaults(defineProps<{
  label: string
  description?: string
  /** 左侧图标徽章（用于突出的总开关行） */
  icon?: string
  /** 单行降透明度（组内仅部分选项被禁用时） */
  dimmed?: boolean
}>(), { dimmed: false })
</script>

<template>
  <div
    class="flex items-center justify-between gap-4 p-4 transition-opacity"
    :class="dimmed && 'opacity-60'"
  >
    <div class="flex min-w-0 items-center gap-3">
      <span
        v-if="icon"
        class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary"
      >
        <Icon :name="icon" class="size-5" />
      </span>
      <div class="min-w-0">
        <p class="text-sm font-medium text-highlighted">
          {{ label }}
        </p>
        <p v-if="description" class="mt-0.5 text-xs text-muted">
          {{ description }}
        </p>
      </div>
    </div>
    <div class="flex shrink-0 items-center">
      <slot />
    </div>
  </div>
</template>
