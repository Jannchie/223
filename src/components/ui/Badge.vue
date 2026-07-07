<script setup lang="ts">
withDefaults(defineProps<{
  color?: 'primary' | 'neutral' | 'error' | 'warning' | 'success'
  variant?: 'solid' | 'soft' | 'outline'
  size?: 'xs' | 'sm' | 'md'
}>(), { color: 'primary', variant: 'soft', size: 'md' })
</script>

<template>
  <span class="ui-badge" :data-color="color" :data-variant="variant" :data-size="size">
    <slot />
  </span>
</template>

<style scoped>
.ui-badge {
  --c: var(--ui-primary);
  --c-soft: var(--ui-primary-soft);
  --c-on: var(--ui-text-inverted);

  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 500;
  line-height: 1.2;
  border: 1px solid transparent;
  border-radius: 999px;
  white-space: nowrap;
}

.ui-badge[data-color="neutral"] { --c: var(--ui-text-muted); --c-soft: var(--ui-bg-muted); }
.ui-badge[data-color="error"] { --c: var(--ui-error); --c-soft: color-mix(in oklab, var(--ui-error) 14%, transparent); --c-on: #fff; }
.ui-badge[data-color="warning"] { --c: var(--ui-warning); --c-soft: color-mix(in oklab, var(--ui-warning) 16%, transparent); --c-on: #fff; }
.ui-badge[data-color="success"] { --c: var(--ui-success); --c-soft: color-mix(in oklab, var(--ui-success) 16%, transparent); --c-on: #fff; }

.ui-badge[data-variant="soft"] { background: var(--c-soft); color: var(--c); }
.ui-badge[data-variant="solid"] { background: var(--c); color: var(--c-on); }
.ui-badge[data-variant="outline"] { color: var(--c); border-color: color-mix(in oklab, var(--c) 40%, var(--ui-border)); }

.ui-badge[data-size="xs"] { font-size: 10px; padding: 1px 6px; }
.ui-badge[data-size="sm"] { font-size: 11px; padding: 2px 8px; }
.ui-badge[data-size="md"] { font-size: 12px; padding: 3px 9px; }
</style>
