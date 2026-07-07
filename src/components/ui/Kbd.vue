<script setup lang="ts">
defineProps<{ value?: string }>()
</script>

<template>
  <kbd class="ui-kbd"><slot>{{ value }}</slot></kbd>
</template>

<style scoped>
.ui-kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  padding: 2px 6px;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-sm);
  background: var(--ui-bg-muted);
  color: var(--ui-text-highlighted);
  font-family: ui-monospace, "SFMono-Regular", "Cascadia Code", Consolas, monospace;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.4;
}
</style>
