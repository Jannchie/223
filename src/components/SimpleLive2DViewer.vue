<script setup lang="ts">
import { useLocalStorage } from '@vueuse/core'
import { Live2DModel } from 'pixi-live2d-display-lipsyncpatch/cubism4'
import { Application, Ticker } from 'pixi.js'
import { onMounted, onUnmounted, ref } from 'vue'

// 鼠标位置状态
const mouseX = ref(0)
const mouseY = ref(0)
let model: Live2DModel | null = null
let app: Application | null = null

// 拖拽和缩放状态
const isDragging = ref(false)
const dragStartX = ref(0)
const dragStartY = ref(0)
const canvasStartX = ref(0)
const canvasStartY = ref(0)
const canvasScale = useLocalStorage('live2d-canvas-scale', 1)
const minScale = 0.1
const maxScale = 3

// canvas位置和尺寸 - 使用localStorage保存
const canvasX = useLocalStorage('live2d-canvas-x', 0)
const canvasY = useLocalStorage('live2d-canvas-y', 0)
const canvasWidth = useLocalStorage('live2d-canvas-width', 800)
const canvasHeight = useLocalStorage('live2d-canvas-height', 1200)

// 存储模型的基础缩放比例
let baseModelScale = 1

// 更新canvas属性和位置
function updateCanvasProperties() {
  const canvas = document.querySelector('#canvas') as HTMLCanvasElement
  if (canvas && app) {
    // 设置canvas的实际尺寸
    const newWidth = canvasWidth.value * canvasScale.value
    const newHeight = canvasHeight.value * canvasScale.value

    canvas.width = newWidth
    canvas.height = newHeight
    canvas.style.position = 'absolute'
    canvas.style.left = `${canvasX.value}px`
    canvas.style.top = `${canvasY.value}px`

    // 重新设置PIXI应用的尺寸
    app.renderer.resize(newWidth, newHeight)

    // 重新调整模型位置和缩放以适应新的canvas尺寸
    if (model) {
      model.position.set(newWidth / 2, newHeight / 2)
      // 根据canvas缩放调整模型缩放
      model.scale.set(baseModelScale * canvasScale.value, baseModelScale * canvasScale.value)
    }
  }
}

// 鼠标移动事件处理（主要用于拖拽）
function handleMouseMove(event: MouseEvent) {
  // 如果正在拖拽，更新canvas位置
  if (isDragging.value) {
    const deltaX = event.clientX - dragStartX.value
    const deltaY = event.clientY - dragStartY.value

    canvasX.value = canvasStartX.value + deltaX
    canvasY.value = canvasStartY.value + deltaY

    updateCanvasProperties()

    // 拖拽时也要更新鼠标位置，以便眼球追踪
    mouseX.value = event.clientX
    mouseY.value = event.clientY
  }
  // 其他鼠标移动由全局处理器处理
}

// 检查点击是否在canvas区域内
function isPointInCanvas(clientX: number, clientY: number): boolean {
  const currentCanvasWidth = canvasWidth.value * canvasScale.value
  const currentCanvasHeight = canvasHeight.value * canvasScale.value

  return (clientX >= canvasX.value
          && clientX <= canvasX.value + currentCanvasWidth
          && clientY >= canvasY.value
          && clientY <= canvasY.value + currentCanvasHeight)
}

// 鼠标按下事件处理
function handleMouseDown(event: MouseEvent) {
  // 只有点击在canvas区域内才处理拖拽
  if (isPointInCanvas(event.clientX, event.clientY)) {
    isDragging.value = true
    dragStartX.value = event.clientX
    dragStartY.value = event.clientY
    canvasStartX.value = canvasX.value
    canvasStartY.value = canvasY.value

    event.preventDefault()
    event.stopPropagation()
  }
  else { /* empty */ }
}

// 鼠标释放事件处理
function handleMouseUp(_: MouseEvent) {
  if (isDragging.value) {
    isDragging.value = false
  }
}

// 滚轮事件处理（以鼠标位置为中心缩放canvas）
function handleWheel(event: WheelEvent) {
  // 只有滚轮在canvas区域内才响应缩放
  if (isPointInCanvas(event.clientX, event.clientY)) {
    event.preventDefault()
    event.stopPropagation()

    // 计算缩放变化
    const scaleDelta = event.deltaY > 0 ? -0.1 : 0.1
    const oldScale = canvasScale.value
    const newScale = Math.max(minScale, Math.min(maxScale, oldScale + scaleDelta))

    if (newScale !== oldScale) {
      // 计算鼠标相对于canvas的位置
      const mouseRelativeX = event.clientX - canvasX.value
      const mouseRelativeY = event.clientY - canvasY.value

      // 计算缩放后的新尺寸
      // const oldWidth = canvasWidth.value * oldScale;
      // const oldHeight = canvasHeight.value * oldScale;
      // const newWidth = canvasWidth.value * newScale;
      // const newHeight = canvasHeight.value * newScale;

      // 计算缩放中心点的偏移
      const scaleRatio = newScale / oldScale
      const offsetX = mouseRelativeX * (1 - scaleRatio)
      const offsetY = mouseRelativeY * (1 - scaleRatio)

      // 更新canvas位置和缩放
      canvasScale.value = newScale
      canvasX.value += offsetX
      canvasY.value += offsetY

      updateCanvasProperties()
    }
  }
  // 在透明区域滚轮不阻止默认行为，让桌面程序正常响应滚轮
}

// 点击事件处理
function handleClick(event: MouseEvent) {
  // 如果点击不在canvas区域内，不阻止事件，让桌面程序处理
  if (!isPointInCanvas(event.clientX, event.clientY)) {
    // 不调用preventDefault或stopPropagation，让事件继续传播

  }
  // 在canvas区域内的点击可以添加其他逻辑
}

// 右键菜单事件处理
function handleContextMenu(event: MouseEvent) {
  // 如果右键不在canvas区域内，不阻止事件，让桌面右键菜单正常显示
  if (!isPointInCanvas(event.clientX, event.clientY)) {
    return
  }
  // 在canvas区域内的右键，阻止默认菜单
  event.preventDefault()
}

// 通过Electron API获取本地文件路径
function getModelURL() {
  const model_path = '06-v2.1024/06-v2.model3.json'
  if ((globalThis as any).electronAPI) {
    return (globalThis as any).electronAPI.getModelPath(model_path)
  }
  // 开发模式下的回退路径
  return `${globalThis.location.origin}/models/${model_path}`
}

onMounted(async () => {
  try {
    const canvas = document.querySelector('#canvas') as HTMLCanvasElement
    if (!canvas) {
      return
    }

    // 设置初始canvas尺寸
    const initialWidth = 400
    const initialHeight = 600

    app = new Application({
      width: initialWidth,
      height: initialHeight,
      view: canvas,
      backgroundAlpha: 0,
      powerPreference: 'high-performance',
      antialias: false,
      preserveDrawingBuffer: true,
      clearBeforeRender: true,
      sharedTicker: true,
    })

    // 限制帧率为 60fps
    app.ticker.maxFPS = 30
    app.ticker.minFPS = 1;
    (globalThis as any).app = app

    const modelURL = getModelURL()
    model = await Live2DModel.from(modelURL, {
      ticker: Ticker.shared,
    })

    app.stage.addChild(model)

    // 设置模型显示
    model.anchor.set(0.5, 0.5)
    model.position.set(initialWidth / 2, initialHeight / 2)

    // 确保模型在可视范围内
    baseModelScale = Math.min(initialWidth / model.width, initialHeight / model.height) * 0.8
    model.scale.set(baseModelScale, baseModelScale)

    // 初始化canvas位置和尺寸（仅在localStorage为空时设置默认值）
    if (canvasWidth.value === 800 && canvasHeight.value === 1200) {
      canvasWidth.value = initialWidth
      canvasHeight.value = initialHeight
    }
    if (canvasX.value === 0 && canvasY.value === 0) {
      canvasX.value = (window.innerWidth - canvasWidth.value * canvasScale.value) / 2
      canvasY.value = (window.innerHeight - canvasHeight.value * canvasScale.value) / 2
    }

    // 应用初始设置
    updateCanvasProperties()
  }
  catch {
    // 模型加载失败
  }
})

// 组件卸载时清理事件监听器
onUnmounted(() => {
  if ((globalThis as any).electronAPI && (globalThis as any).electronAPI.removeMousePositionListener) {
    (globalThis as any).electronAPI.removeMousePositionListener()
  }
})
</script>

<template>
  <div
    class="live2d-container"
    @mousemove="handleMouseMove"
    @mouseover="handleMouseMove"
    @mouseout="handleMouseMove"
    @mousedown="handleMouseDown"
    @mouseup="handleMouseUp"
    @wheel="handleWheel"
    @click="handleClick"
    @contextmenu="handleContextMenu"
  >
    <canvas id="canvas" />
  </div>
</template>

<style scoped>
.live2d-container {
  width: 100vw;
  height: 100vh;
  position: fixed;
  top: 0;
  left: 0;
  z-index: 1;
  -webkit-app-region: no-drag;
  /* 确保可以接收所有鼠标事件 */
  pointer-events: auto;
  /* 添加几乎透明的背景，确保透明区域也能接收鼠标事件 */
  background-color: rgba(0, 0, 0, 0.001);
}

#canvas {
  display: block;
  -webkit-app-region: no-drag;
  pointer-events: auto;
  /* 位置和尺寸通过JavaScript动态设置 */
}
</style>
