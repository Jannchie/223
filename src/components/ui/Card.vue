<script setup lang="ts">
import { useSlots } from 'vue'

const slots = useSlots()
</script>

<template>
  <div class="ui-card">
    <div v-if="slots.header" class="ui-card-section ui-card-header" data-slot="header">
      <slot name="header" />
    </div>
    <div class="ui-card-section ui-card-body" data-slot="body">
      <slot />
    </div>
    <div v-if="slots.footer" class="ui-card-section ui-card-footer" data-slot="footer">
      <slot name="footer" />
    </div>
  </div>
</template>

<style scoped>
.ui-card {
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--ui-bg);
}

.ui-card-section {
  padding: 18px 20px;
}

.ui-card-header {
  border-bottom: 1px solid var(--ui-border);
}

.ui-card-footer {
  border-top: 1px solid var(--ui-border);
}
</style>
