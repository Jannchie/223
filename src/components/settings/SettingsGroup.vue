<script setup lang="ts">
withDefaults(defineProps<{
  /** 整组降透明度（例如总开关关闭时） */
  dimmed?: boolean
}>(), { dimmed: false })
</script>

<template>
  <div class="settings-group" :data-dimmed="dimmed ? 'true' : undefined">
    <slot />
  </div>
</template>

<style scoped>
.settings-group {
  overflow: hidden;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-2xl);
  background: var(--ui-bg-elevated);
  transition: opacity 0.15s ease;
}

.settings-group[data-dimmed="true"] {
  opacity: 0.6;
}

/* 行间分割线由组件自己负责，不依赖 divide-y / divide-default 的工具类配对 */
.settings-group > :slotted(* + *) {
  border-top: 1px solid var(--ui-border);
}
</style>
