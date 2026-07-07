<script setup lang="ts">
import { useSlots } from 'vue'
import Icon from './Icon.vue'

withDefaults(defineProps<{
  color?: 'primary' | 'neutral' | 'error' | 'warning' | 'success'
  variant?: 'soft' | 'subtle'
  icon?: string
  title?: string
  description?: string
}>(), { color: 'primary', variant: 'soft' })

const slots = useSlots()
</script>

<template>
  <div class="ui-alert" :data-color="color" :data-variant="variant">
    <Icon v-if="icon" :name="icon" class="ui-alert-icon" />
    <div class="ui-alert-body">
      <p v-if="title" class="ui-alert-title">
        {{ title }}
      </p>
      <p v-if="description" class="ui-alert-desc">
        {{ description }}
      </p>
      <slot />
    </div>
    <div v-if="slots.actions" class="ui-alert-actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
.ui-alert {
  --c: var(--ui-primary);
  --c-soft: var(--ui-primary-soft);

  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border-radius: var(--ui-radius-lg);
  border: 1px solid transparent;
  background: var(--c-soft);
  color: var(--ui-text);
}

.ui-alert[data-color="error"] { --c: var(--ui-error); --c-soft: color-mix(in oklab, var(--ui-error) 10%, transparent); }
.ui-alert[data-color="warning"] { --c: var(--ui-warning); --c-soft: color-mix(in oklab, var(--ui-warning) 12%, transparent); }
.ui-alert[data-color="success"] { --c: var(--ui-success); --c-soft: color-mix(in oklab, var(--ui-success) 12%, transparent); }
.ui-alert[data-color="neutral"] { --c: var(--ui-text-muted); --c-soft: var(--ui-bg-muted); }

.ui-alert[data-variant="subtle"] {
  border-color: color-mix(in oklab, var(--c) 30%, transparent);
}

.ui-alert-icon {
  flex-shrink: 0;
  margin-top: 1px;
  font-size: 18px;
  color: var(--c);
}

.ui-alert-body {
  flex: 1;
  min-width: 0;
}

.ui-alert-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
}

.ui-alert-desc {
  margin: 2px 0 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--ui-text-muted);
  white-space: pre-wrap;
  word-break: break-word;
}

.ui-alert-actions {
  flex-shrink: 0;
}
</style>
