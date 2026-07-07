<script setup lang="ts">
import { ref, watch } from 'vue'
import Icon from './Icon.vue'

const props = withDefaults(defineProps<{
  src?: string
  alt?: string
  icon?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
}>(), { size: 'md' })

const failed = ref(false)
watch(() => props.src, () => { failed.value = false })
</script>

<template>
  <span class="ui-avatar" :data-size="size">
    <img
      v-if="src && !failed"
      :src="src"
      :alt="alt"
      class="ui-avatar-img"
      @error="failed = true"
    >
    <Icon v-else-if="icon" :name="icon" class="ui-avatar-icon" />
    <span v-else class="ui-avatar-fallback">{{ (alt || '?').charAt(0) }}</span>
  </span>
</template>

<style scoped>
.ui-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
  border-radius: 50%;
  background: var(--ui-bg-muted);
  color: var(--ui-text-muted);
}

.ui-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.ui-avatar-icon { font-size: 60%; }
.ui-avatar-fallback { font-weight: 600; text-transform: uppercase; }

.ui-avatar[data-size="xs"] { width: 24px; height: 24px; font-size: 12px; }
.ui-avatar[data-size="sm"] { width: 30px; height: 30px; font-size: 13px; }
.ui-avatar[data-size="md"] { width: 38px; height: 38px; font-size: 15px; }
.ui-avatar[data-size="lg"] { width: 46px; height: 46px; font-size: 18px; }
.ui-avatar[data-size="xl"] { width: 64px; height: 64px; font-size: 24px; }
</style>
