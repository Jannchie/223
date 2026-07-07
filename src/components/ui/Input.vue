<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import Icon from './Icon.vue'

defineOptions({ inheritAttrs: false })

withDefaults(defineProps<{
  modelValue?: string | number
  icon?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  disabled?: boolean
}>(), { size: 'md' })

const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()

const attrs = useAttrs()

// class / style 落到外层容器，其余原生属性与事件监听透传到 <input>
const rootAttrs = computed(() => ({ class: (attrs as any).class, style: (attrs as any).style }))
const inputAttrs = computed(() => {
  const { class: _c, style: _s, ...rest } = attrs as any
  return rest
})

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).value)
}
</script>

<template>
  <div
    class="ui-input"
    :data-size="size"
    :data-disabled="disabled ? 'true' : undefined"
    v-bind="rootAttrs"
  >
    <Icon v-if="icon" :name="icon" class="ui-input-icon" />
    <input
      class="ui-input-el"
      data-slot="base"
      :value="modelValue"
      :disabled="disabled"
      v-bind="inputAttrs"
      @input="onInput"
    >
  </div>
</template>

<style scoped>
.ui-input {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
}

.ui-input-el {
  width: 100%;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius);
  background: var(--ui-bg-elevated);
  color: var(--ui-text);
  font-family: inherit;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.15s ease, background 0.15s ease;
  -webkit-app-region: no-drag;
}

.ui-input-el::placeholder { color: var(--ui-text-dimmed); }
.ui-input-el:focus { border-color: var(--ui-primary); }
.ui-input-el:disabled { background: var(--ui-bg-muted); cursor: not-allowed; }

.ui-input[data-size="xs"] .ui-input-el { font-size: 12px; padding: 5px 9px; }
.ui-input[data-size="sm"] .ui-input-el { font-size: 13px; padding: 7px 11px; }
.ui-input[data-size="md"] .ui-input-el { font-size: 14px; padding: 8px 12px; }
.ui-input[data-size="lg"] .ui-input-el { font-size: 15px; padding: 10px 14px; }
.ui-input[data-size="xl"] .ui-input-el { font-size: 16px; padding: 12px 16px; }

.ui-input-icon {
  position: absolute;
  left: 12px;
  color: var(--ui-text-dimmed);
  font-size: 15px;
  pointer-events: none;
}

.ui-input:has(.ui-input-icon) .ui-input-el { padding-left: 36px; }
</style>
