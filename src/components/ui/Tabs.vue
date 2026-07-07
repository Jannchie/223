<script setup lang="ts">
import Icon from './Icon.vue'

interface TabItem { label: string, value: string, icon?: string }

withDefaults(defineProps<{
  modelValue?: string
  items?: TabItem[]
  content?: boolean
  color?: string
  variant?: string
  size?: 'sm' | 'md' | 'lg'
  ui?: Record<string, string>
}>(), { size: 'md', items: () => [] })

const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()
</script>

<template>
  <div class="ui-tabs" :data-size="size">
    <button
      v-for="item in items"
      :key="item.value"
      type="button"
      class="ui-tab"
      :data-active="modelValue === item.value ? 'true' : undefined"
      @click="emit('update:modelValue', item.value)"
    >
      <Icon v-if="item.icon" :name="item.icon" class="ui-tab-icon" />
      <span>{{ item.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.ui-tabs {
  display: flex;
  gap: 4px;
  width: 100%;
  padding: 4px;
  background: var(--ui-bg-muted);
  border-radius: var(--ui-radius-lg);
}

.ui-tab {
  flex: 1 1 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 0;
  padding: 8px 10px;
  border: none;
  border-radius: var(--ui-radius);
  background: transparent;
  color: var(--ui-text-muted);
  font-family: inherit;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s ease, color 0.15s ease;
}

.ui-tabs[data-size="sm"] .ui-tab { font-size: 12px; padding: 6px 8px; }
.ui-tabs[data-size="md"] .ui-tab { font-size: 13px; }
.ui-tabs[data-size="lg"] .ui-tab { font-size: 14px; padding: 10px 12px; }

.ui-tab:hover:not([data-active]) {
  color: var(--ui-text-highlighted);
}

.ui-tab[data-active="true"] {
  background: var(--ui-primary);
  color: var(--ui-text-inverted);
}

.ui-tab-icon {
  font-size: 1.15em;
}
</style>
