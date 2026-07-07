<script setup lang="ts">
import { computed, useAttrs } from 'vue'

defineOptions({ inheritAttrs: false })

withDefaults(defineProps<{
  modelValue?: string
  rows?: number
  disabled?: boolean
}>(), { rows: 4 })

const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()

const attrs = useAttrs()
const rootAttrs = computed(() => ({ class: (attrs as any).class, style: (attrs as any).style }))
const areaAttrs = computed(() => {
  const { class: _c, style: _s, ...rest } = attrs as any
  return rest
})

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLTextAreaElement).value)
}
</script>

<template>
  <div class="ui-textarea" v-bind="rootAttrs">
    <textarea
      class="ui-textarea-el"
      data-slot="base"
      :rows="rows"
      :value="modelValue"
      :disabled="disabled"
      v-bind="areaAttrs"
      @input="onInput"
    />
  </div>
</template>

<style scoped>
.ui-textarea {
  display: flex;
  width: 100%;
}

.ui-textarea-el {
  width: 100%;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius);
  background: var(--ui-bg-elevated);
  color: var(--ui-text);
  font-family: inherit;
  font-size: 14px;
  line-height: 1.6;
  padding: 10px 12px;
  outline: none;
  resize: vertical;
  box-sizing: border-box;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.ui-textarea-el::placeholder { color: var(--ui-text-dimmed); }
.ui-textarea-el:focus { border-color: var(--ui-primary); }
.ui-textarea-el:disabled { background: var(--ui-bg-muted); cursor: not-allowed; }
</style>
