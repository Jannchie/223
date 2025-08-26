<script setup lang="ts">
import { ref } from 'vue'
import SimpleLive2DViewer from './components/SimpleLive2DViewer.vue'

const live2dViewer = ref()

// Use local model file from public directory
const modelUrl = '/models/06-v2.model3.json'

const loadExampleModel = () => {
  if (live2dViewer.value) {
    live2dViewer.value.loadModel(modelUrl)
  }
}
</script>

<template>
  <div class="app-container">
    <SimpleLive2DViewer
      ref="live2dViewer"
      :width="400"
      :height="600"
    />
    <div class="controls">
      <button @click="loadExampleModel" class="load-btn">Reload Model</button>
    </div>
  </div>
</template>

<style scoped>
.app-container {
  width: 100%;
  height: 100vh;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.controls {
  position: absolute;
  bottom: 20px;
  right: 20px;
  -webkit-app-region: no-drag;
}

.load-btn {
  padding: 8px 16px;
  background-color: rgba(100, 108, 255, 0.8);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.load-btn:hover {
  background-color: rgba(100, 108, 255, 1);
}
</style>
