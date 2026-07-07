import type { Live2DModel } from '@jannchie/pixi-live2d-display'
import { useLocalStorage } from '@vueuse/core'
import { Application, Ticker } from 'pixi.js'
import { ref } from 'vue'

export function useLive2DCanvas() {
  const app = new Application()
  const model = ref<Live2DModel | null>(null)

  // Canvas state (persisted)
  const canvasX = useLocalStorage('live2d-canvas-x', 0)
  const canvasY = useLocalStorage('live2d-canvas-y', 0)
  const canvasWidth = useLocalStorage('live2d-canvas-width', 800)
  const canvasHeight = useLocalStorage('live2d-canvas-height', 1200)
  const canvasScale = useLocalStorage('live2d-canvas-scale', 1)

  const minScale = 0.1
  const maxScale = 3
  let baseModelScale = 1

  // Dragging internals
  const isDragging = ref(false)
  const dragStartX = ref(0)
  const dragStartY = ref(0)
  const canvasStartX = ref(0)
  const canvasStartY = ref(0)

  async function initApp(view: HTMLCanvasElement, opts?: { width?: number, height?: number, backgroundAlpha?: number }) {
    await app.init({
      width: opts?.width ?? 400,
      height: opts?.height ?? 600,
      view,
      backgroundAlpha: opts?.backgroundAlpha ?? 0,
      backgroundColor: 0x00_00_00,
      clearBeforeRender: false,
      powerPreference: 'high-performance',
      antialias: false,
    })
  }

  async function loadModelFromURL(modelURL: string) {
    const { Live2DModel } = await import('@jannchie/pixi-live2d-display')
    // remove previous
    if (model.value) {
      app.stage.removeChild(model.value as any)
      model.value.destroy()
    }
    const m = await Live2DModel.from(modelURL, { ticker: Ticker.shared })
    m.setRenderer(app.renderer)
    app.stage.addChild(m as any)
    model.value = m
    const initialWidth = canvasWidth.value
    const initialHeight = canvasHeight.value
    m.anchor.set(0.5, 0.5)
    m.position.set(initialWidth / 2, initialHeight / 2)
    baseModelScale = Math.min(initialWidth / m.width, initialHeight / m.height) * 0.8
    m.scale.set(baseModelScale * canvasScale.value, baseModelScale * canvasScale.value)
    if (typeof globalThis !== 'undefined') {
      ;(globalThis as any).live2dModel = m
    }
  }

  function updateCanvasProperties() {
    const canvas = document.querySelector('#canvas') as HTMLCanvasElement
    if (!canvas) {
      return
    }
    const newWidth = canvasWidth.value * canvasScale.value
    const newHeight = canvasHeight.value * canvasScale.value
    canvas.width = newWidth
    canvas.height = newHeight
    canvas.style.position = 'absolute'
    canvas.style.left = `${canvasX.value}px`
    canvas.style.top = `${canvasY.value}px`
    app.renderer?.resize(newWidth, newHeight)
    if (model.value) {
      model.value.position.set(newWidth / 2, newHeight / 2)
      model.value.scale.set(baseModelScale * canvasScale.value, baseModelScale * canvasScale.value)
    }
  }

  function startDrag(clientX: number, clientY: number) {
    isDragging.value = true
    dragStartX.value = clientX
    dragStartY.value = clientY
    canvasStartX.value = canvasX.value
    canvasStartY.value = canvasY.value
  }

  function dragTo(clientX: number, clientY: number) {
    if (!isDragging.value) {
      return
    }
    const deltaX = clientX - dragStartX.value
    const deltaY = clientY - dragStartY.value
    canvasX.value = canvasStartX.value + deltaX
    canvasY.value = canvasStartY.value + deltaY
    updateCanvasProperties()
  }

  function endDrag() {
    isDragging.value = false
  }

  function wheelZoomAt(clientX: number, clientY: number, deltaY: number) {
    const oldScale = canvasScale.value
    const newScale = Math.max(minScale, Math.min(maxScale, oldScale + (deltaY > 0 ? -0.1 : 0.1)))
    if (newScale === oldScale) {
      return
    }
    const mouseRelativeX = clientX - canvasX.value
    const mouseRelativeY = clientY - canvasY.value
    const scaleRatio = newScale / oldScale
    const offsetX = mouseRelativeX * (1 - scaleRatio)
    const offsetY = mouseRelativeY * (1 - scaleRatio)
    canvasScale.value = newScale
    canvasX.value += offsetX
    canvasY.value += offsetY
    updateCanvasProperties()
  }

  return {
    // core
    app,
    model,
    initApp,
    loadModelFromURL,
    updateCanvasProperties,
    // canvas state
    canvasX,
    canvasY,
    canvasWidth,
    canvasHeight,
    canvasScale,
    minScale,
    maxScale,
    isDragging,
    // interactions
    startDrag,
    dragTo,
    endDrag,
    wheelZoomAt,
  }
}
