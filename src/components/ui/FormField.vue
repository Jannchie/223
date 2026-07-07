<script setup lang="ts">
defineProps<{
  label?: string
  description?: string
  required?: boolean
  error?: string
}>()
</script>

<template>
  <div class="ui-field">
    <div v-if="label || description" class="ui-field-labels">
      <label v-if="label" class="ui-field-label">
        {{ label }}<span v-if="required" class="ui-field-required">*</span>
      </label>
      <p v-if="description" class="ui-field-desc">{{ description }}</p>
    </div>
    <slot />
    <p v-if="error" class="ui-field-error">{{ error }}</p>
  </div>
</template>

<style scoped>
.ui-field-labels {
  margin-bottom: 6px;
}

.ui-field-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: var(--ui-text-highlighted);
}

.ui-field-required {
  margin-left: 2px;
  color: var(--ui-error);
}

.ui-field-desc {
  margin: 2px 0 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--ui-text-muted);
}

.ui-field-error {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--ui-error);
}
</style>
