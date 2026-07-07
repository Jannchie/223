<script setup lang="ts">
import { computed } from 'vue'
import Icon from './Icon.vue'

interface Item { label: string, value: string | number, description?: string }

const props = withDefaults(defineProps<{
  modelValue?: string | number | null
  items?: Item[]
  icon?: string
  placeholder?: string
  disabled?: boolean
  loading?: boolean
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
}>(), { size: 'md', items: () => [] })

const emit = defineEmits<{ (e: 'update:modelValue', v: string | number): void }>()

const currentValue = computed(() => (props.modelValue == null ? '' : String(props.modelValue)))

function onChange(e: Event) {
  const raw = (e.target as HTMLSelectElement).value
  const item = props.items.find(i => String(i.value) === raw)
  emit('update:modelValue', item ? item.value : raw)
}
</script>

<template>
  <div
    class="ui-select"
    :data-size="size"
    :data-disabled="(disabled || loading) ? 'true' : undefined"
  >
    <Icon v-if="icon" :name="icon" class="ui-select-icon" />
    <select
      class="ui-select-el"
      :value="currentValue"
      :disabled="disabled || loading"
      @change="onChange"
    >
      <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
      <option
        v-for="item in items"
        :key="String(item.value)"
        :value="String(item.value)"
      >
        {{ item.label }}
      </option>
    </select>
    <svg class="ui-select-chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  </div>
</template>

<style scoped>
.ui-select {
  position: relative;
  display: inline-flex;
  align-items: center;
  width: 100%;
}

.ui-select-el {
  appearance: none;
  -webkit-appearance: none;
  width: 100%;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius);
  background: var(--ui-bg-elevated);
  color: var(--ui-text);
  font-family: inherit;
  outline: none;
  cursor: pointer;
  box-sizing: border-box;
  padding-right: 34px;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.ui-select-el:focus { border-color: var(--ui-primary); }
.ui-select-el:disabled { background: var(--ui-bg-muted); color: var(--ui-text-dimmed); cursor: not-allowed; }

.ui-select[data-size="xs"] .ui-select-el { font-size: 12px; padding: 5px 9px; padding-right: 30px; }
.ui-select[data-size="sm"] .ui-select-el { font-size: 13px; padding: 7px 11px; padding-right: 32px; }
.ui-select[data-size="md"] .ui-select-el { font-size: 14px; padding: 8px 12px; padding-right: 34px; }
.ui-select[data-size="lg"] .ui-select-el { font-size: 15px; padding: 10px 14px; padding-right: 36px; }
.ui-select[data-size="xl"] .ui-select-el { font-size: 16px; padding: 12px 16px; padding-right: 38px; }

.ui-select-icon {
  position: absolute;
  left: 12px;
  color: var(--ui-text-dimmed);
  font-size: 15px;
  pointer-events: none;
}

.ui-select:has(.ui-select-icon) .ui-select-el { padding-left: 36px; }

.ui-select-chevron {
  position: absolute;
  right: 11px;
  color: var(--ui-text-dimmed);
  pointer-events: none;
}
</style>
