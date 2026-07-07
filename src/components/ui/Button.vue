<script setup lang="ts">
import { useSlots } from 'vue'
import Icon from './Icon.vue'

withDefaults(defineProps<{
  color?: 'primary' | 'neutral' | 'error' | 'warning' | 'success'
  variant?: 'solid' | 'soft' | 'ghost' | 'outline' | 'subtle' | 'link'
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  icon?: string
  trailingIcon?: string
  block?: boolean
  square?: boolean
  loading?: boolean
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
}>(), {
  color: 'primary',
  variant: 'solid',
  size: 'md',
  type: 'button',
})

const slots = useSlots()
</script>

<template>
  <button
    class="ui-btn"
    :data-color="color"
    :data-variant="variant"
    :data-size="size"
    :data-block="block ? 'true' : undefined"
    :data-square="square ? 'true' : undefined"
    :type="type"
    :disabled="disabled || loading"
  >
    <span v-if="loading" class="ui-btn-spinner" />
    <Icon v-else-if="icon" :name="icon" class="ui-btn-icon" />
    <span v-if="slots.default" class="ui-btn-label"><slot /></span>
    <Icon v-if="trailingIcon && !loading" :name="trailingIcon" class="ui-btn-icon" />
  </button>
</template>

<style scoped>
.ui-btn {
  --c: var(--ui-primary);
  --c-hover: var(--ui-primary-hover);
  --c-soft: var(--ui-primary-soft);
  --c-on: var(--ui-text-inverted);

  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid transparent;
  border-radius: var(--ui-radius);
  font-family: inherit;
  font-weight: 500;
  line-height: 1.25;
  cursor: pointer;
  white-space: nowrap;
  user-select: none;
  -webkit-app-region: no-drag;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.ui-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ui-btn:focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: 2px;
}

.ui-btn[data-block="true"] {
  display: flex;
  width: 100%;
}

/* 颜色令牌 */
.ui-btn[data-color="error"] {
  --c: var(--ui-error);
  --c-hover: var(--ui-error);
  --c-soft: color-mix(in oklab, var(--ui-error) 12%, transparent);
  --c-on: #fff;
}
.ui-btn[data-color="warning"] {
  --c: var(--ui-warning);
  --c-hover: var(--ui-warning);
  --c-soft: color-mix(in oklab, var(--ui-warning) 14%, transparent);
  --c-on: #fff;
}
.ui-btn[data-color="success"] {
  --c: var(--ui-success);
  --c-hover: var(--ui-success);
  --c-soft: color-mix(in oklab, var(--ui-success) 14%, transparent);
  --c-on: #fff;
}
.ui-btn[data-color="neutral"] {
  --c: var(--ui-text-highlighted);
  --c-soft: var(--ui-bg-muted);
  --c-on: var(--ui-text-inverted);
}

/* 变体 */
.ui-btn[data-variant="solid"] {
  background: var(--c);
  color: var(--c-on);
}
.ui-btn[data-variant="solid"]:hover:not(:disabled) {
  background: var(--c-hover);
}
.ui-btn[data-color="neutral"][data-variant="solid"] {
  background: var(--ui-bg-inverted);
  color: var(--ui-text-inverted);
}
.ui-btn[data-color="neutral"][data-variant="solid"]:hover:not(:disabled) {
  background: color-mix(in oklab, var(--ui-bg-inverted) 85%, var(--ui-text-muted));
}

.ui-btn[data-variant="soft"] {
  background: var(--c-soft);
  color: var(--c);
}
.ui-btn[data-color="neutral"][data-variant="soft"] {
  color: var(--ui-text-highlighted);
}
.ui-btn[data-variant="soft"]:hover:not(:disabled) {
  background: color-mix(in oklab, var(--c) 18%, transparent);
}
.ui-btn[data-color="neutral"][data-variant="soft"]:hover:not(:disabled) {
  background: var(--ui-border);
}

.ui-btn[data-variant="ghost"] {
  background: transparent;
  color: var(--c);
}
.ui-btn[data-color="neutral"][data-variant="ghost"] {
  color: var(--ui-text-muted);
}
.ui-btn[data-variant="ghost"]:hover:not(:disabled) {
  background: var(--c-soft);
}
.ui-btn[data-color="neutral"][data-variant="ghost"]:hover:not(:disabled) {
  background: var(--ui-bg-muted);
  color: var(--ui-text-highlighted);
}

.ui-btn[data-variant="outline"] {
  background: transparent;
  color: var(--c);
  border-color: color-mix(in oklab, var(--c) 45%, var(--ui-border));
}
.ui-btn[data-variant="outline"]:hover:not(:disabled) {
  background: var(--c-soft);
}

.ui-btn[data-variant="subtle"] {
  background: var(--c-soft);
  color: var(--c);
  border-color: color-mix(in oklab, var(--c) 25%, transparent);
}
.ui-btn[data-variant="subtle"]:hover:not(:disabled) {
  background: color-mix(in oklab, var(--c) 16%, transparent);
}

.ui-btn[data-variant="link"] {
  background: transparent;
  color: var(--c);
  padding-left: 0;
  padding-right: 0;
}
.ui-btn[data-variant="link"]:hover:not(:disabled) {
  text-decoration: underline;
}

/* 尺寸 */
.ui-btn[data-size="xs"] { font-size: 12px; padding: 4px 8px; gap: 4px; border-radius: var(--ui-radius-sm); }
.ui-btn[data-size="sm"] { font-size: 13px; padding: 6px 11px; }
.ui-btn[data-size="md"] { font-size: 14px; padding: 8px 14px; }
.ui-btn[data-size="lg"] { font-size: 15px; padding: 10px 18px; border-radius: var(--ui-radius-lg); }
.ui-btn[data-size="xl"] { font-size: 16px; padding: 12px 22px; border-radius: var(--ui-radius-lg); }

/* 图标专用（正方形） */
.ui-btn[data-square="true"] { padding: 0; }
.ui-btn[data-square="true"][data-size="xs"] { width: 24px; height: 24px; }
.ui-btn[data-square="true"][data-size="sm"] { width: 30px; height: 30px; }
.ui-btn[data-square="true"][data-size="md"] { width: 36px; height: 36px; }
.ui-btn[data-square="true"][data-size="lg"] { width: 42px; height: 42px; }
.ui-btn[data-square="true"][data-size="xl"] { width: 48px; height: 48px; }
.ui-btn[data-square="true"] :deep(.ui-icon) { width: 1.25em; height: 1.25em; }

.ui-btn-icon { font-size: 1em; }

.ui-btn-spinner {
  width: 1em;
  height: 1em;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: ui-btn-spin 0.6s linear infinite;
}

@keyframes ui-btn-spin {
  to { transform: rotate(360deg); }
}
</style>
