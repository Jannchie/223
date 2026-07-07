<script setup lang="ts">
defineProps<{
  modelValue?: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()

function toggle(target: EventTarget | null) {
  emit('update:modelValue', (target as HTMLInputElement).checked)
}
</script>

<template>
  <label class="ui-switch" :data-disabled="disabled ? 'true' : undefined">
    <input
      class="ui-switch-input"
      type="checkbox"
      role="switch"
      :checked="modelValue"
      :disabled="disabled"
      @change="toggle($event.target)"
    >
    <span class="ui-switch-track">
      <span class="ui-switch-thumb" />
    </span>
  </label>
</template>

<style scoped>
.ui-switch {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  -webkit-app-region: no-drag;
}

.ui-switch[data-disabled="true"] {
  opacity: 0.5;
  cursor: not-allowed;
}

.ui-switch-input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.ui-switch-track {
  display: inline-flex;
  align-items: center;
  width: 40px;
  height: 24px;
  padding: 2px;
  border-radius: 999px;
  background: var(--ui-bg-muted);
  border: 1px solid var(--ui-border);
  transition: background 0.18s ease, border-color 0.18s ease;
}

.ui-switch-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.18s ease;
}

.ui-switch-input:checked + .ui-switch-track {
  background: var(--ui-primary);
  border-color: var(--ui-primary);
}

.ui-switch-input:checked + .ui-switch-track .ui-switch-thumb {
  transform: translateX(16px);
}

.ui-switch-input:focus-visible + .ui-switch-track {
  outline: 2px solid var(--ui-primary);
  outline-offset: 2px;
}
</style>
