<script setup lang="ts">
import { onUnmounted, watch } from 'vue'

const props = withDefaults(defineProps<{
  open?: boolean
  close?: boolean
  dismissible?: boolean
  ui?: { content?: string }
}>(), { dismissible: true })

const emit = defineEmits<{ (e: 'update:open', v: boolean): void }>()

function requestClose() {
  if (props.dismissible) {
    emit('update:open', false)
  }
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open) {
    e.stopPropagation()
    requestClose()
  }
}

watch(() => props.open, (open) => {
  if (open) {
    document.addEventListener('keydown', onKey, true)
  }
  else {
    document.removeEventListener('keydown', onKey, true)
  }
}, { immediate: true })

onUnmounted(() => document.removeEventListener('keydown', onKey, true))
</script>

<template>
  <Teleport to="body">
    <Transition name="ui-modal">
      <div v-if="open" class="ui-modal-overlay" @mousedown.self="requestClose">
        <div class="ui-modal-panel" :class="ui?.content">
          <slot name="content" />
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.ui-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: color-mix(in oklab, #18181b 45%, transparent);
  backdrop-filter: blur(2px);
  box-sizing: border-box;
}

.ui-modal-panel {
  width: 100%;
  max-width: 32rem;
  max-height: 92vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: var(--ui-bg);
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-2xl);
}

.ui-modal-enter-active,
.ui-modal-leave-active {
  transition: opacity 0.18s ease;
}

.ui-modal-enter-active .ui-modal-panel,
.ui-modal-leave-active .ui-modal-panel {
  transition: transform 0.18s ease, opacity 0.18s ease;
}

.ui-modal-enter-from,
.ui-modal-leave-to {
  opacity: 0;
}

.ui-modal-enter-from .ui-modal-panel,
.ui-modal-leave-to .ui-modal-panel {
  transform: translateY(8px) scale(0.98);
  opacity: 0;
}
</style>
