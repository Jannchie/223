<script setup lang="ts">
import { computed } from 'vue'
import { icons } from './icons'

const props = defineProps<{ name?: string }>()

const icon = computed(() => (props.name ? icons[props.name] : undefined))
</script>

<template>
  <svg
    v-if="icon"
    class="ui-icon"
    :viewBox="icon.v"
    width="1em"
    height="1em"
    fill="currentColor"
    aria-hidden="true"
    v-html="icon.b"
  />
</template>

<style scoped>
.ui-icon {
  display: inline-block;
  vertical-align: -0.125em;
  flex-shrink: 0;
}
</style>
