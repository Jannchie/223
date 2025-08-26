<template>
  <div ref="live2dContainer" class="live2d-container"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Application } from 'pixi.js'

const live2dContainer = ref<HTMLDivElement>()
let app: Application | null = null
let model: any = null

const props = defineProps<{
  modelUrl?: string
  width?: number
  height?: number
}>()

onMounted(async () => {
  if (!live2dContainer.value) {
    console.error('live2dContainer not found')
    return
  }

  console.log('Starting Live2D viewer initialization...')

  try {
    // Import PIXI
    const PIXI = await import('pixi.js')
    
    // Expose PIXI to window so that pixi-live2d-display can reference it
    ;(window as any).PIXI = PIXI
    console.log('PIXI exposed to window')
    
    // Check if Live2D runtime is available
    if (!(window as any).LIVE2DCUBISMCORE) {
      console.warn('Live2D Cubism Core not found on window. Checking script loading...')
      
      // Wait a bit for scripts to load
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      if (!(window as any).LIVE2DCUBISMCORE) {
        console.error('Live2D Cubism Core is still not available')
      } else {
        console.log('Live2D Cubism Core found after waiting')
      }
    } else {
      console.log('Live2D Cubism Core is available')
    }

    // Create PIXI application
    console.log('Creating PIXI Application...')
    app = new PIXI.Application()
    
    console.log('Initializing PIXI app...')
    await app.init({
      width: props.width || 400,
      height: props.height || 600,
      backgroundColor: 0x000000,
      backgroundAlpha: 0,
      antialias: true,
    })

    console.log('Appending canvas to container...')
    live2dContainer.value.appendChild(app.canvas)
    console.log('PIXI app initialized successfully')

    // Load Live2D model if provided
    if (props.modelUrl) {
      console.log('Loading Live2D model:', props.modelUrl)
      await loadLive2DModel(props.modelUrl)
    }
  } catch (error) {
    console.error('Failed to initialize Live2D viewer:', error)
    console.error('Error stack:', error)
  }
})

onUnmounted(() => {
  if (model) {
    model.release()
  }
  if (app) {
    app.destroy()
  }
  
  // Cleanup is handled automatically by the browser
})

const loadLive2DModel = async (modelJsonUrl: string) => {
  if (!app) {
    console.error('PIXI app not initialized')
    return
  }

  try {
    console.log('Loading Live2D model with pixi-live2d-display:', modelJsonUrl)
    console.log('Full URL path:', new URL(modelJsonUrl, window.location.origin).href)
    
    // Clear existing content
    app.stage.removeChildren()
    
    // Import Live2DModel - try both import paths
    let Live2DModel
    try {
      const module = await import('pixi-live2d-display/cubism4')
      Live2DModel = module.Live2DModel
      console.log('Successfully imported from pixi-live2d-display/cubism4')
    } catch (e1) {
      console.warn('Failed to import from /cubism4, trying default import:', e1)
      try {
        const module = await import('pixi-live2d-display')
        Live2DModel = module.Live2DModel
        console.log('Successfully imported from pixi-live2d-display')
      } catch (e2) {
        console.error('Failed to import Live2DModel from both paths:', e1, e2)
        throw new Error('Could not import Live2DModel')
      }
    }
    
    console.log('Creating Live2D model from:', modelJsonUrl)
    
    // Check if the model file exists first
    try {
      const response = await fetch(modelJsonUrl)
      if (!response.ok) {
        throw new Error(`Model file not found: ${response.status} ${response.statusText}`)
      }
      const modelData = await response.json()
      console.log('Model JSON loaded successfully:', modelData)
    } catch (fetchError) {
      console.error('Failed to fetch model JSON:', fetchError)
      throw fetchError
    }
    
    // Load Live2D model
    const live2dModel = await Live2DModel.from(modelJsonUrl)
    
    console.log('Live2D model loaded successfully:', live2dModel)
    console.log('Model dimensions:', live2dModel.width, 'x', live2dModel.height)
    
    // Scale and position the model
    const containerWidth = props.width || 400
    const containerHeight = props.height || 600
    
    // Scale to fit nicely in the container
    const scale = Math.min(containerWidth / live2dModel.width, containerHeight / live2dModel.height) * 0.8
    live2dModel.scale.set(scale)
    
    // Center the model
    live2dModel.x = containerWidth / 2
    live2dModel.y = containerHeight / 2
    live2dModel.anchor.set(0.5, 0.5)
    
    // Add to stage (type assertion for compatibility)
    app.stage.addChild(live2dModel as any)
    
    // Add interaction
    live2dModel.on('hit', (hitAreas: string[]) => {
      console.log('Model hit areas:', hitAreas)
      if (hitAreas.includes('body')) {
        live2dModel.motion('tap_body')
      }
    })
    
    // Store reference
    model = live2dModel
    
    console.log('Live2D model setup complete!')
    
  } catch (error: any) {
    console.error('Failed to load Live2D model:', error)
    console.error('Error details:', error.message, error.stack)
    
    // Fallback to texture display
    try {
      const textureUrl = '/models/06-v2.1024/texture_00.png'
      console.log('Falling back to texture loading:', textureUrl)
      
      const PIXI = await import('pixi.js')
      await PIXI.Assets.load(textureUrl)
      const texture = PIXI.Texture.from(textureUrl)
      
      const sprite = new PIXI.Sprite(texture)
      const scale = 0.4
      sprite.scale.set(scale)
      sprite.x = (props.width || 400) / 2 - (texture.width * scale) / 2
      sprite.y = (props.height || 600) / 2 - (texture.height * scale) / 2
      
      app.stage.addChild(sprite)
      
      // Add error text
      const text = new PIXI.Text({
        text: '06-v2 Texture Only\n(Live2D loading failed)',
        style: {
          fontFamily: 'Arial',
          fontSize: 14,
          fill: 0xffaa00,
          align: 'center'
        }
      })
      text.x = (props.width || 400) / 2
      text.y = 50
      text.anchor.set(0.5, 0)
      app.stage.addChild(text)
      
    } catch (fallbackError) {
      console.error('Fallback also failed:', fallbackError)
      
      // Show error placeholder
      const PIXI = await import('pixi.js')
      const errorText = new PIXI.Text({
        text: 'Failed to load model\nCheck console for details',
        style: {
          fontFamily: 'Arial',
          fontSize: 16,
          fill: 0xff0000,
          align: 'center'
        }
      })
      errorText.x = (props.width || 400) / 2
      errorText.y = (props.height || 600) / 2
      errorText.anchor.set(0.5, 0.5)
      app.stage.addChild(errorText)
    }
  }
}

// Expose method to parent component
defineExpose({
  loadModel: loadLive2DModel
})
</script>

<style scoped>
.live2d-container {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.live2d-container canvas {
  display: block;
}
</style>