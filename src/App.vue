<script setup lang="ts">
import SimpleLive2DViewer from './components/SimpleLive2DViewer.vue'
</script>

<template>
  <UApp class="app-container">
    <SimpleLive2DViewer />
  </UApp>
</template>

<style scoped>
.app-container {
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;
  overflow: hidden;
}
</style>
