<!-- eslint-disable no-console -->
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

// 目光追踪相关状态
const gazeTargetX = ref<number | null>(null)
const gazeTargetY = ref<number | null>(null)

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

// 设置目光追踪目标的钩子函数
function setGazeTarget(x: number, y: number) {
  gazeTargetX.value = x
  gazeTargetY.value = y
}

// 清除目光追踪目标，回到鼠标追踪模式
function clearGazeTarget() {
  gazeTargetX.value = null
  gazeTargetY.value = null
}

// 将钩子函数暴露到全局
if (typeof globalThis !== 'undefined') {
  (globalThis as any).setGazeTarget = setGazeTarget;
  (globalThis as any).clearGazeTarget = clearGazeTarget
}

// 将屏幕坐标转换为模型相对坐标系的函数
function screenToModelCoords(screenX: number, screenY: number) {
  if (!model || !app) {
    return { x: 0, y: 0 }
  }

  // 计算相对于canvas的坐标
  const canvasRelativeX = screenX - canvasX.value
  const canvasRelativeY = screenY - canvasY.value

  // 考虑canvas的缩放
  const actualCanvasWidth = canvasWidth.value * canvasScale.value
  const actualCanvasHeight = canvasHeight.value * canvasScale.value

  // 归一化坐标 (-1 到 1)
  const normalizedX = (canvasRelativeX / actualCanvasWidth) * 2 - 1
  const normalizedY = (canvasRelativeY / actualCanvasHeight) * 2 - 1

  return { x: normalizedX, y: normalizedY }
}

// 更新Live2D模型的眼球参数
function updateGazeParameters() {
  if (!model || !model.internalModel) {
    return
  }

  let targetX = 0
  let targetY = 0

  // 如果设置了目标坐标，使用目标坐标；否则使用鼠标坐标
  if (gazeTargetX.value !== null && gazeTargetY.value !== null) {
    const coords = screenToModelCoords(gazeTargetX.value, gazeTargetY.value)
    targetX = coords.x
    targetY = coords.y
  }
  else {
    // 使用鼠标位置
    const coords = screenToModelCoords(mouseX.value, mouseY.value)
    targetX = coords.x
    targetY = coords.y
  }

  // 限制目光角度范围，防止眼球转动过度
  const maxAngle = 30 // 最大角度（度数）
  targetX = Math.max(-maxAngle, Math.min(maxAngle, targetX * maxAngle))
  targetY = Math.max(-maxAngle, Math.min(maxAngle, -targetY * maxAngle)) // Y轴反转

  // 设置Live2D眼球参数
  try {
    // 使用pixi-live2d-display的正确API
    if (model.internalModel) {
      const internalModel = model.internalModel as any
      // 尝试不同的API调用方式
      if (typeof internalModel.setParameterValueById === 'function') {
        internalModel.setParameterValueById('ParamAngleX', targetX)
        internalModel.setParameterValueById('ParamAngleY', targetY)
        internalModel.setParameterValueById('ParamEyeLOpen', 1)
        internalModel.setParameterValueById('ParamEyeROpen', 1)
      }
      else if (internalModel.coreModel && typeof internalModel.coreModel.setParameterValueById === 'function') {
        internalModel.coreModel.setParameterValueById('ParamAngleX', targetX)
        internalModel.coreModel.setParameterValueById('ParamAngleY', targetY)
        internalModel.coreModel.setParameterValueById('ParamEyeLOpen', 1)
        internalModel.coreModel.setParameterValueById('ParamEyeROpen', 1)
      }
      else {
        // 打印可用的方法和属性，帮助调试
        console.log('Available methods on internalModel:', Object.getOwnPropertyNames(internalModel))
        if (internalModel.coreModel) {
          console.log('Available methods on coreModel:', Object.getOwnPropertyNames(internalModel.coreModel))
        }
      }
    }
  }
  catch (error) {
    console.log('Error updating gaze parameters:', error)
  }
}

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
  // 更新鼠标位置
  mouseX.value = event.clientX
  mouseY.value = event.clientY

  // 如果正在拖拽，更新canvas位置
  if (isDragging.value) {
    const deltaX = event.clientX - dragStartX.value
    const deltaY = event.clientY - dragStartY.value

    canvasX.value = canvasStartX.value + deltaX
    canvasY.value = canvasStartY.value + deltaY

    updateCanvasProperties()
  }
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

    // 启动眼球追踪更新循环
    app.ticker.add(updateGazeParameters)

    // 监听electron后端的全局鼠标位置
    if ((globalThis as any).electronAPI && (globalThis as any).electronAPI.onMousePosition) {
      (globalThis as any).electronAPI.onMousePosition((position: { x: number, y: number }) => {
        // 将electron上报的全局鼠标坐标设置为目光追踪目标
        setGazeTarget(position.x, position.y)
      })
    }
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
  // 清理ticker
  if (app) {
    app.ticker.remove(updateGazeParameters)
  }
  // 清理全局函数
  if (typeof globalThis !== 'undefined') {
    delete (globalThis as any).setGazeTarget
    delete (globalThis as any).clearGazeTarget
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
