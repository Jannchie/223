<template>
  <div ref="canvasContainer" class="live2d-container">
    <div class="debug-info">
      <p>Live2D Status: {{ status }}</p>
      <p>Current Model: {{ currentModel }}</p>
      <button @click="testModelLoading" class="test-btn">Test Model Loading</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const canvasContainer = ref<HTMLDivElement>()
const status = ref('Initializing...')
const currentModel = ref('None')

onMounted(async () => {
  status.value = 'Checking dependencies...'
  
  // Check if Live2D scripts are loaded
  console.log('Window objects:')
  console.log('LIVE2DCUBISMCORE:', (window as any).LIVE2DCUBISMCORE)
  console.log('Live2DCubismCore:', (window as any).Live2DCubismCore)
  
  // Check if PIXI can be imported
  try {
    const PIXI = await import('pixi.js')
    console.log('PIXI imported successfully:', PIXI)
    ;(window as any).PIXI = PIXI
    status.value = 'PIXI loaded'
  } catch (error) {
    console.error('Failed to import PIXI:', error)
    status.value = 'PIXI import failed'
    return
  }
  
  // Check if pixi-live2d-display can be imported
  try {
    const live2dModule = await import('pixi-live2d-display')
    console.log('pixi-live2d-display imported:', live2dModule)
    status.value = 'Live2D display module loaded'
  } catch (error) {
    console.error('Failed to import pixi-live2d-display:', error)
    status.value = 'Live2D module import failed'
  }
  
  // Test model file accessibility
  await testModelLoading()
})

const testModelLoading = async () => {
  status.value = 'Testing model file access...'
  
  const modelUrl = '/models/06-v2.model3.json'
  console.log('Testing model URL:', modelUrl)
  
  try {
    const response = await fetch(modelUrl)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const modelData = await response.json()
    console.log('Model data loaded:', modelData)
    currentModel.value = modelUrl
    status.value = 'Model JSON accessible'
    
    // Test texture file
    const textureUrl = `/models/${modelData.FileReferences.Textures[0]}`
    console.log('Testing texture URL:', textureUrl)
    
    const textureResponse = await fetch(textureUrl)
    if (textureResponse.ok) {
      console.log('Texture file accessible')
      status.value = 'All model files accessible'
    } else {
      console.error('Texture file not accessible:', textureResponse.status)
      status.value = 'Texture file missing'
    }
    
  } catch (error: any) {
    console.error('Model loading test failed:', error)
    status.value = `Model test failed: ${error.message}`
  }
}

defineProps<{
  width?: number
  height?: number
}>()
</script>

<style scoped>
.live2d-container {
  width: 100%;
  height: 100%;
  position: relative;
  background: rgba(0, 0, 0, 0.1);
}

.debug-info {
  position: absolute;
  top: 10px;
  left: 10px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 10px;
  border-radius: 5px;
  font-size: 12px;
  z-index: 1000;
}

.test-btn {
  margin-top: 10px;
  padding: 5px 10px;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 3px;
  cursor: pointer;
}

.test-btn:hover {
  background: #45a049;
}
</style>