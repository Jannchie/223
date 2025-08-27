<!-- eslint-disable no-console -->
<script setup lang="ts">
import { Live2DModel } from '@jannchie/pixi-live2d-display'
import { useLocalStorage } from '@vueuse/core'
import { Application, Ticker } from 'pixi.js'
import { onMounted, onUnmounted, ref } from 'vue'
import { getChatInstance, initOpenAI } from '../utils/openai'

// 输入框相关状态
const inputText = ref('')
const inputPositionY = ref(0)
const cursorPosition = ref({ x: 0, y: 0 })
const isInputFocused = ref(false)

// 聊天相关状态
const isTyping = ref(false)
const currentResponse = ref('')
const showBubble = ref(false)
const bubbleContent = ref('')
const bubbleTimeout = ref<NodeJS.Timeout | null>(null)
const bubblePositionX = ref(0)
const bubblePositionY = ref(0)

// 说话动画相关状态
const speakingTimer = ref<NodeJS.Timeout | null>(null)

// OpenAI 配置
const apiKey = useLocalStorage('openai-api-key', '')
const baseURL = useLocalStorage('openai-base-url', 'https://api.openai.com/v1')
const showSettings = ref(false)

// 窗口尺寸
const windowHeight = ref(window.innerHeight)

// 输入框显示控制
const isInputVisible = ref(false)

// 鼠标位置状态
const mouseX = ref(0)
const mouseY = ref(0)
let model: Live2DModel | null = null
const app = new Application()
// 目光追踪相关状态
const gazeTargetX = ref<number | null>(null)
const gazeTargetY = ref<number | null>(null)

// 记录上次的目标值，用于检测变化
const lastTargetX = ref(0)
const lastTargetY = ref(0)
const lastGazeSourceType = ref('')

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

// 计算输入框光标的屏幕坐标位置
function calculateCursorPosition(inputElement: HTMLInputElement) {
  try {
    // 获取光标位置
    const selectionStart = inputElement.selectionStart || 0
    const textBeforeCursor = inputElement.value.slice(0, Math.max(0, selectionStart))

    // 获取输入框的样式信息（只需要获取一次）
    const computedStyle = globalThis.getComputedStyle(inputElement)

    // 更精确的文本宽度测量
    let textWidth = 0

    try {
      // 创建一个临时的镜像元素
      const mirror = document.createElement('div')
      const inputStyles = getComputedStyle(inputElement)

      // 复制输入框的所有相关样式
      const stylesToCopy = [
        'position',
        'left',
        'top',
        'width',
        'height',
        'fontFamily',
        'fontSize',
        'fontWeight',
        'fontStyle',
        'letterSpacing',
        'wordSpacing',
        'textTransform',
        'padding',
        'border',
        'boxSizing',
        'whiteSpace',
        'wordWrap',
        'lineHeight',
      ]

      for (const prop of stylesToCopy) {
        mirror.style.setProperty(prop, inputStyles.getPropertyValue(prop))
      }

      mirror.style.position = 'absolute'
      mirror.style.visibility = 'hidden' // 隐藏调试元素
      mirror.style.pointerEvents = 'none'
      mirror.style.whiteSpace = 'pre'
      mirror.style.top = '10px' // 调试位置
      mirror.style.left = '10px'
      mirror.style.border = '1px solid red' // 红色边框
      mirror.style.zIndex = '10000' // 确保显示在最上层

      // 添加光标前的文本和一个测量点
      const textNode = document.createTextNode(textBeforeCursor)
      const measureSpan = document.createElement('span')
      measureSpan.style.position = 'relative'
      measureSpan.textContent = '' // 移除可见标记

      mirror.append(textNode)
      mirror.append(measureSpan)
      document.body.append(mirror)

      const mirrorRect = mirror.getBoundingClientRect()
      const measureSpanRect = measureSpan.getBoundingClientRect()

      // 计算光标位置，使用 span 的左边缘作为光标位置
      textWidth = measureSpanRect.left - mirrorRect.left

      // 获取输入框的实际内边距，用于更精确的计算
      const mirrorPaddingLeft = Number.parseFloat(getComputedStyle(mirror).paddingLeft) || 0
      textWidth -= mirrorPaddingLeft

      mirror.remove()
    }
    catch {
      textWidth = textBeforeCursor.length * 8 // 回退到估算值
    }

    // 获取输入框的内边距和边框
    const paddingLeft = Number.parseFloat(computedStyle.paddingLeft) || 0
    const borderLeft = Number.parseFloat(computedStyle.borderLeftWidth) || 0

    // 获取输入框的实时全局位置（关键：每次都要重新获取，因为输入框会跟随模型移动）
    const currentInputRect = inputElement.getBoundingClientRect()

    // 计算光标的绝对屏幕坐标（基于实时的输入框位置）
    const rawCursorX = currentInputRect.left + paddingLeft + borderLeft + textWidth
    const absoluteCursorY = currentInputRect.top + currentInputRect.height / 2

    // 限制光标位置不超出文本框右边界
    const inputRightBoundary = currentInputRect.right - paddingLeft - borderLeft
    const absoluteCursorX = Math.min(rawCursorX, inputRightBoundary)

    const finalCursorX = absoluteCursorX

    // 使用修正后的坐标
    cursorPosition.value = { x: finalCursorX, y: absoluteCursorY }

    // 当输入框聚焦时，设置目光跟随光标位置
    if (isInputFocused.value) {
      setGazeTarget(finalCursorX, absoluteCursorY)
    }
  }
  catch {
    // 忽略错误
  }
}

// 防抖函数
function debounce<T extends (...args: any[]) => void>(func: T, delay: number): T {
  let timeoutId: NodeJS.Timeout
  return ((...args: any[]) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => func(...args), delay)
  }) as T
}

// 防抖的光标位置计算函数
const debouncedCalculateCursorPosition = debounce((inputElement: HTMLInputElement) => {
  calculateCursorPosition(inputElement)
}, 50)

// 初始化 OpenAI
function initializeOpenAI() {
  if (apiKey.value) {
    try {
      initOpenAI(apiKey.value, baseURL.value)
      // 显示欢迎消息
      showTemporaryBubble('嗨~我是06娘！快来和我聊天吧~ ✨', 4000)
    }
    catch {
      // 忽略错误
    }
  }
  else {
    // 如果没有配置API Key，显示提示消息
    showTemporaryBubble('点击下方的设置按钮⚙️配置API Key就可以和我聊天啦~', 6000)
  }
}

// 发送消息
async function sendMessage() {
  const content = inputText.value.trim()
  if (!content || isTyping.value) {
    return
  }

  const chatInstance = getChatInstance()
  if (!chatInstance) {
    showTemporaryBubble('请先配置 OpenAI API Key')
    return
  }

  // 清空输入框
  inputText.value = ''
  isTyping.value = true
  currentResponse.value = ''

  // 用户发送消息后，让角色面向前方（看向用户）
  if (model) {
    // 清除当前的目光追踪，让角色看向前方
    // clearGazeTarget()
    // 计算角色正前方的位置（角色头顶正前方）
    const characterCenterX = canvasX.value + (canvasWidth.value * canvasScale.value) / 2
    const characterFrontY = canvasY.value // 角色头顶前方位置
    setTimeout(() => {
      setGazeTarget(characterCenterX, characterFrontY)
    }, 100)
  }

  try {
    await chatInstance.sendMessage(content, {
      onToken: (token: string) => {
        currentResponse.value += token
        showBubble.value = true
        bubbleContent.value = currentResponse.value
        updateBubblePosition() // 每次更新内容时也更新气泡位置
      },
      onComplete: (fullContent: string) => {
        isTyping.value = false
        bubbleContent.value = fullContent
        updateBubblePosition() // 完成时更新气泡位置

        // AI 回复完成后自动聚焦到输入框
        setTimeout(() => {
          const inputElement = document.querySelector('.text-input') as HTMLInputElement
          if (inputElement) {
            inputElement.focus()
            // 确保输入框可见
            isInputVisible.value = true
          }
        }, 100)

        // 5秒后隐藏气泡
        if (bubbleTimeout.value) {
          clearTimeout(bubbleTimeout.value)
        }
        bubbleTimeout.value = setTimeout(() => {
          showBubble.value = false
        }, 5000)
      },
      onError: (error: string) => {
        isTyping.value = false
        showTemporaryBubble(`错误: ${error}`)
      },
    })
  }
  catch {
    isTyping.value = false
    showTemporaryBubble('发送消息失败')
  }
}

// 显示临时气泡
function showTemporaryBubble(content: string, duration: number = 3000) {
  bubbleContent.value = content
  showBubble.value = true
  updateBubblePosition() // 更新气泡位置
  if (bubbleTimeout.value) {
    clearTimeout(bubbleTimeout.value)
  }
  bubbleTimeout.value = setTimeout(() => {
    showBubble.value = false
  }, duration)
}

// 输入框事件处理
function handleInputFocus(event: FocusEvent) {
  isInputFocused.value = true
  isInputVisible.value = true // 聚焦时保持可见
  const inputElement = event.target as HTMLInputElement
  calculateCursorPosition(inputElement)
}

function handleInputBlur() {
  isInputFocused.value = false
  // 失去焦点时恢复到鼠标追踪模式
  clearGazeTarget()
  // 失去焦点后如果鼠标不在交互区域，隐藏输入框
  setTimeout(() => {
    if (!checkMouseInInteractiveArea(mouseX.value, mouseY.value)) {
      isInputVisible.value = false
    }
  }, 100)
}

function handleInputChange(event: Event) {
  const inputElement = event.target as HTMLInputElement
  if (isInputFocused.value) {
    // 使用防抖函数避免频繁计算
    debouncedCalculateCursorPosition(inputElement)
  }
}

function handleInputCursorMove(event: Event) {
  const inputElement = event.target as HTMLInputElement
  if (isInputFocused.value) {
    // 立即计算光标位置，不使用防抖
    calculateCursorPosition(inputElement)
  }
}

// 处理回车键
function handleKeyDown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    sendMessage()
  }
}

// 将钩子函数暴露到全局
if (typeof globalThis !== 'undefined') {
  (globalThis as any).setGazeTarget = setGazeTarget;
  (globalThis as any).clearGazeTarget = clearGazeTarget
}

// 获取角色头顶的屏幕坐标
function getCharacterTopPosition(): { x: number, y: number } {
  if (!model || !app) {
    // 默认回退位置：canvas中心顶部
    return {
      x: canvasX.value + (canvasWidth.value * canvasScale.value) / 2,
      y: canvasY.value,
    }
  }

  try {
    // 使用Live2D模型的getBounds()方法获取准确的边界信息
    const bounds = model.getBounds()

    // bounds包含了模型的实际渲染边界
    // bounds.x, bounds.y 是边界框左上角的世界坐标
    // bounds.width, bounds.height 是边界框的尺寸

    // 计算模型头顶在世界坐标系中的位置
    const modelTopWorldX = bounds.x + bounds.width / 2 // 中心X坐标
    const modelTopWorldY = bounds.y // 顶部Y坐标

    // 将世界坐标转换为屏幕坐标
    // 需要考虑canvas的位置和缩放
    const screenCenterX = canvasX.value + modelTopWorldX
    const screenTop = canvasY.value + modelTopWorldY

    return {
      x: screenCenterX,
      y: screenTop,
    }
  }
  catch {
    // 回退到默认位置：使用模型的基本属性估算
    const modelCenterX = canvasX.value + model.x
    const modelTop = canvasY.value + model.y - (model.height * model.scale.y) / 2

    return {
      x: modelCenterX,
      y: modelTop,
    }
  }
}

// 更新气泡位置
function updateBubblePosition() {
  const characterTop = getCharacterTopPosition()
  bubblePositionX.value = characterTop.x
  // 气泡位置定位到角色头顶，通过CSS的transform: translate(-50%, -100%)实现底部对齐
  // 这样气泡的底部会与角色头顶对齐，并且会有一点间距（通过CSS或这里微调）
  bubblePositionY.value = characterTop.y
}

// 计算输入框基于模型的位置
function calculateInputPosition() {
  if (!model || !app) {
    inputPositionY.value = (canvasHeight.value * canvasScale.value) * 0.6 // 默认回退位置
    return
  }

  try {
    // 基于模型的实际高度和位置计算胸部位置
    // model.y 是模型在canvas中的位置（相对于canvas）
    const modelCenterY = model.y
    const modelHeight = model.height * model.scale.y

    // 胸部通常在模型中心下方约1/6到1/4的位置，输入框放在胸部下方
    const chestRelativeY = modelCenterY + modelHeight * 0.15 // 胸部位置（相对于canvas）
    const inputOffsetY = 50 // 固定的像素偏移
    const inputRelativeY = chestRelativeY + inputOffsetY // 在胸部下方（相对于canvas）

    // 存储相对于canvas的坐标，在模板中会加上canvasY
    inputPositionY.value = inputRelativeY
  }
  catch {
    // 回退到默认位置
    inputPositionY.value = (canvasHeight.value * canvasScale.value) * 0.6
  }
}

// 计算目光追踪的目标位置
function updateGazeParameters() {
  if (!model) {
    return
  }

  let targetScreenX = 0
  let targetScreenY = 0
  let sourceType = ''
  // 如果设置了目标坐标，使用目标坐标；否则使用鼠标坐标
  if (gazeTargetX.value !== null && gazeTargetY.value !== null) {
    targetScreenX = gazeTargetX.value
    targetScreenY = gazeTargetY.value
    sourceType = isInputFocused.value ? '光标' : 'Electron鼠标'
  }
  else {
    // 使用鼠标位置（本地鼠标追踪）
    targetScreenX = mouseX.value
    targetScreenY = mouseY.value
    sourceType = '本地鼠标'
  }

  // 检查目标位置是否有变化
  const threshold = 2 // 屏幕像素阈值，减少抖动
  const hasChanged = (
    Math.abs(targetScreenX - lastTargetX.value) > threshold
    || Math.abs(targetScreenY - lastTargetY.value) > threshold
    || sourceType !== lastGazeSourceType.value
  )

  // 只在有变化时才更新
  if (hasChanged) {
    // 尝试从 Live2D 模型中获取眼睛坐标
    let eyeScreenX = canvasX.value + (canvasWidth.value * canvasScale.value) / 2 // 默认位置
    let eyeScreenY = canvasY.value + (canvasHeight.value * canvasScale.value) * 0.35 // 默认位置

    try {
      const internalModel = model.internalModel as any

      // 方法1：尝试获取眼睛相关的 drawable
      if (internalModel.coreModel && internalModel.coreModel.getDrawableCount) {
        const drawableCount = internalModel.coreModel.getDrawableCount()
        for (let i = 0; i < drawableCount; i++) {
          try {
            const drawableId = internalModel.coreModel.getDrawableId(i)
            // 寻找眼睛相关的drawable（常见命名包含eye、Eye、目等）
            if (drawableId && (drawableId.includes('Eye') || drawableId.includes('eye') || drawableId.includes('目')) // 尝试获取drawable的位置信息
              && internalModel.coreModel.getDrawableVertexPositions) {
              const vertices = internalModel.coreModel.getDrawableVertexPositions(i)
              if (vertices && vertices.length >= 2) {
                // 计算drawable的中心点（取顶点的平均值）
                let centerX = 0; let centerY = 0
                const vertexCount = vertices.length / 2
                for (let j = 0; j < vertices.length; j += 2) {
                  centerX += vertices[j]
                  centerY += vertices[j + 1]
                }
                centerX /= vertexCount
                centerY /= vertexCount

                // 转换为屏幕坐标
                const worldPos = model.toGlobal({ x: centerX, y: centerY })
                eyeScreenX = worldPos.x
                eyeScreenY = worldPos.y
                break // 找到第一个眼睛就使用它
              }
            }
          }
          catch {
            // 忽略单个drawable的错误，继续搜索
          }
        }
      }
    }
    catch (error) {
      console.log('获取眼睛坐标时出错:', error)
      // 使用默认估算位置
    }

    // 计算从眼睛到目标位置的方向向量
    const directionX = targetScreenX - eyeScreenX
    const directionY = targetScreenY - eyeScreenY

    // 计算方向向量的长度
    const directionLength = Math.hypot(directionX, directionY)

    // 避免除零错误
    if (directionLength === 0) {
      return
    }

    // 归一化方向向量
    const normalizedX = directionX / directionLength
    const normalizedY = directionY / directionLength

    // 从眼睛位置沿着方向延伸1000px
    const projectionDistance = 10_000
    const projectionScreenX = eyeScreenX + normalizedX * projectionDistance
    const projectionScreenY = eyeScreenY + normalizedY * projectionDistance

    // 转换投影点为相对于 canvas 的坐标
    const projectionCanvasX = projectionScreenX - canvasX.value
    const projectionCanvasY = projectionScreenY - canvasY.value

    // 转换为模型坐标（Live2D 期望的世界坐标）
    const modelX = projectionCanvasX / canvasScale.value
    const modelY = projectionCanvasY / canvasScale.value

    // 使用 Live2D 内置的 focus 方法
    // instant: false 会让 Live2D 自己处理平滑插值
    const instant = false // 总是使用缓动效果，无论是鼠标还是输入框
    model.focus(modelX, modelY, instant)

    // 更新记录的值
    lastTargetX.value = targetScreenX
    lastTargetY.value = targetScreenY
    lastGazeSourceType.value = sourceType
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
    if (app.renderer) {
      app.renderer.resize(newWidth, newHeight)
    }

    // 重新调整模型位置和缩放以适应新的canvas尺寸
    if (model) {
      model.position.set(newWidth / 2, newHeight / 2)
      // 根据canvas缩放调整模型缩放
      model.scale.set(baseModelScale * canvasScale.value, baseModelScale * canvasScale.value)
      // 重新计算输入框位置
      calculateInputPosition()
    }
  }
}

// 检查鼠标是否在输入框或canvas区域
function checkMouseInInteractiveArea(clientX: number, clientY: number): boolean {
  // 检查是否在canvas区域
  const inCanvas = isPointInCanvas(clientX, clientY)
  // 检查是否在输入框区域
  const inInput = isPointInInput(clientX, clientY)
  return inCanvas || inInput
}

// 控制鼠标穿透的函数
function setMouseEventTransparency(shouldIgnore: boolean) {
  if ((globalThis as any).electronAPI && (globalThis as any).electronAPI.setIgnoreMouseEvents) {
    (globalThis as any).electronAPI.setIgnoreMouseEvents({
      ignore: shouldIgnore,
      forward: true
    })
  }
}

// 鼠标移动事件处理（主要用于拖拽）
function handleMouseMove(event: MouseEvent) {
  // 更新鼠标位置
  mouseX.value = event.clientX
  mouseY.value = event.clientY

  // 检查是否应该显示输入框和控制鼠标穿透
  const shouldShowInput = checkMouseInInteractiveArea(event.clientX, event.clientY)
  isInputVisible.value = shouldShowInput
  
  // 根据是否在交互区域控制鼠标穿透
  setMouseEventTransparency(!shouldShowInput)

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
  // 如果点击在输入框区域内，不处理拖拽
  if (isPointInInput(event.clientX, event.clientY)) {
    return
  }

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
}

// 鼠标释放事件处理
function handleMouseUp(_: MouseEvent) {
  if (isDragging.value) {
    isDragging.value = false
  }
}

// 鼠标离开处理
function handleMouseLeave() {
  isInputVisible.value = false
  // 鼠标完全离开应用区域时，恢复完全穿透
  setMouseEventTransparency(true)
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

// 检查点击是否在输入框区域内
function isPointInInput(clientX: number, clientY: number): boolean {
  const inputContainer = document.querySelector('.input-container') as HTMLElement
  if (!inputContainer) {
    return false
  }

  const rect = inputContainer.getBoundingClientRect()
  return (clientX >= rect.left && clientX <= rect.right
          && clientY >= rect.top && clientY <= rect.bottom)
}

// 点击事件处理
function handleClick(event: MouseEvent) {
  // 如果点击在输入框区域内，不阻止事件，让输入框正常响应
  if (isPointInInput(event.clientX, event.clientY)) {
    return
  }

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
  // 在canvas区域内的右键，显示设置面板
  event.preventDefault()
  showSettings.value = true
}

// 保存设置
function saveSettings() {
  initializeOpenAI()
  showSettings.value = false
  showTemporaryBubble('设置已保存')
}

// 取消设置
function cancelSettings() {
  showSettings.value = false
}

// 获取本地模型文件路径
function getModelURL() {
  const model_path = '06-v2.1024/06-v2.model3.json'
  // 直接使用 public 目录下的模型文件
  return `/models/${model_path}`
}

onMounted(async () => {
  // 初始化 OpenAI
  initializeOpenAI()

  // 监听窗口大小变化
  const handleResize = () => {
    windowHeight.value = window.innerHeight
  }
  window.addEventListener('resize', handleResize)

  const canvas = document.querySelector('#canvas') as HTMLCanvasElement
  if (!canvas) {
    return
  }

  // 设置初始canvas尺寸
  const initialWidth = 400
  const initialHeight = 600

  await app.init({
    width: initialWidth,
    height: initialHeight,
    view: canvas,
    backgroundAlpha: 0,
    powerPreference: 'high-performance', // 使用高性能 GPU
    preference: 'webgl2', // 优先使用 WebGL2，回退到 WebGL
    antialias: false, // 关闭抗锯齿以提升性能
  })
  // 限制帧率为 60fps 以平衡性能和流畅度
  Ticker.shared.maxFPS = 60
  // 移除不必要的 minFPS 设置

  const modelURL = getModelURL()
  model = await Live2DModel.from(modelURL, {
    ticker: Ticker.shared,
  })
  model.setRenderer(app.renderer)
  app.stage.addChild(model)

  // 将模型设为全局变量，方便外部访问
  if (typeof globalThis !== 'undefined') {
    (globalThis as any).live2dModel = model
  }

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
  if (app.ticker) {
    // 启动目光追踪更新循环
    app.ticker.add(updateGazeParameters)
    // 启动气泡位置更新循环
    app.ticker.add(updateBubblePosition)
  }

  // 计算并设置输入框位置
  calculateInputPosition()

  // 监听electron后端的全局鼠标位置
  if ((globalThis as any).electronAPI && (globalThis as any).electronAPI.onMousePosition) {
    (globalThis as any).electronAPI.onMousePosition((position: { x: number, y: number }) => {
      // 如果输入框聚焦中，忽略鼠标位置事件，让光标跟踪继续工作
      if (!isInputFocused.value) {
        setGazeTarget(position.x, position.y)
      }
    })
  }
})

// 组件卸载时清理事件监听器
onUnmounted(() => {
  if ((globalThis as any).electronAPI && (globalThis as any).electronAPI.removeMousePositionListener) {
    (globalThis as any).electronAPI.removeMousePositionListener()
  }
  // 清理ticker
  if (app) {
    Ticker.shared.remove(updateGazeParameters)
    Ticker.shared.remove(updateBubblePosition)
  }
  // 清理全局函数和变量
  if (typeof globalThis !== 'undefined') {
    delete (globalThis as any).setGazeTarget
    delete (globalThis as any).clearGazeTarget
    delete (globalThis as any).live2dModel
  }
  // 清理气泡定时器
  if (bubbleTimeout.value) {
    clearTimeout(bubbleTimeout.value)
  }
  // 清理说话动画定时器
  if (speakingTimer.value) {
    clearTimeout(speakingTimer.value)
  }
  // 清理窗口大小监听器
  window.removeEventListener('resize', () => {
    windowHeight.value = window.innerHeight
  })
})
</script>

<template>
  <div
    class="live2d-container"
    @mousemove="handleMouseMove"
    @mouseover="handleMouseMove"
    @mouseout="handleMouseMove"
    @mouseleave="handleMouseLeave"
    @mousedown="handleMouseDown"
    @mouseup="handleMouseUp"
    @wheel="handleWheel"
    @click="handleClick"
    @contextmenu="handleContextMenu"
  >
    <canvas id="canvas" />
    <div
      class="input-container"
      :class="{ 'input-visible': isInputVisible }"
      :style="{
        'left': `${canvasX}px`,
        'top': `${canvasY + inputPositionY}px`,
        'width': `${canvasWidth * canvasScale}px`,
        '--canvas-scale': canvasScale,
      }"
    >
      <input
        v-model="inputText"
        type="text"
        :placeholder="isTyping ? '正在思考...' : '请输入内容（回车发送）...'"
        class="text-input"
        :disabled="isTyping"
        @focus="handleInputFocus"
        @blur="handleInputBlur"
        @input="handleInputChange"
        @keyup="handleInputCursorMove"
        @click="handleInputCursorMove"
        @keydown="handleKeyDown"
        @select="handleInputCursorMove"
      >
      <!-- 设置按钮 -->
      <button
        class="settings-button"
        title="打开设置"
        @click="showSettings = true"
      >
        ⚙️
      </button>
    </div>

    <!-- 对话气泡 -->
    <div
      v-if="showBubble"
      class="chat-bubble"
      :style="{
        left: `${bubblePositionX}px`,
        top: `${bubblePositionY}px`,
        transform: 'translate(-50%, -100%)',
      }"
    >
      <div class="bubble-content">
        {{ bubbleContent }}
        <span v-if="isTyping" class="typing-indicator">|</span>
      </div>
      <div class="bubble-arrow" />
    </div>
  </div>

  <!-- 设置面板 - 独立于主容器 -->
  <teleport to="body">
    <div v-if="showSettings" class="settings-overlay" @click="cancelSettings">
      <div class="settings-panel" @click.stop @keydown.stop @keyup.stop @keypress.stop>
        <h3>OpenAI 设置</h3>
        <div class="setting-item">
          <label>API Key:</label>
          <input
            v-model="apiKey"
            type="password"
            placeholder="输入你的 OpenAI API Key"
            class="setting-input"
          >
        </div>
        <div class="setting-item">
          <label>Base URL:</label>
          <input
            v-model="baseURL"
            type="text"
            placeholder="API 基础地址"
            class="setting-input"
          >
        </div>
        <div class="setting-actions">
          <button class="save-btn" @click="saveSettings">
            保存
          </button>
          <button class="cancel-btn" @click="cancelSettings">
            取消
          </button>
        </div>
      </div>
    </div>
  </teleport>
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

.input-container {
  position: absolute;
  z-index: 100;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  -webkit-app-region: no-drag;
  pointer-events: auto;
  opacity: 0.05;
  transition: opacity 0.3s ease-in-out;
}

.input-container.input-visible {
  opacity: 1;
}

.input-container:focus-within {
  opacity: 1 !important;
}

.input-container:hover {
  opacity: 1 !important;
}

.text-input {
  padding: 12px 16px;
  width: 100%;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  background: rgba(255, 255, 255, 0.9);
  outline: none;
  -webkit-app-region: no-drag;
  pointer-events: auto;
  box-sizing: border-box;
}

.text-input:focus {
  border-color: #4a9eff;
  box-shadow: 0 0 0 3px rgba(74, 158, 255, 0.1);
  background: rgba(255, 255, 255, 0.95);
}

.text-input:disabled {
  background: rgba(230, 230, 230, 0.9);
  cursor: not-allowed;
}

/* 设置按钮样式 */
.settings-button {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
  -webkit-app-region: no-drag;
  pointer-events: auto;
}

.settings-button:hover {
  background: rgba(255, 255, 255, 1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transform: scale(1.05);
}

/* 对话气泡样式 */
.chat-bubble {
  position: absolute;
  z-index: 200;
  max-width: 300px;
  min-width: 150px;
  pointer-events: none;
  -webkit-app-region: no-drag;
}

.bubble-content {
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid #ddd;
  border-radius: 18px;
  padding: 12px 16px;
  font-size: 14px;
  line-height: 1.4;
  color: #333;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  word-wrap: break-word;
  white-space: pre-wrap;
  position: relative;
}

.bubble-arrow {
  position: absolute;
  bottom: -8px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-top: 8px solid rgba(255, 255, 255, 0.95);
}

.bubble-arrow::before {
  content: '';
  position: absolute;
  top: -9px;
  left: -8px;
  width: 0;
  height: 0;
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-top: 8px solid #ddd;
}

/* 打字指示器 */
.typing-indicator {
  animation: blink 1s infinite;
  font-weight: bold;
  color: #4a9eff;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

/* 设置面板样式 */
.settings-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  z-index: 10000;
  display: flex;
  justify-content: center;
  align-items: center;
  -webkit-app-region: no-drag;
  pointer-events: auto;
}

.settings-panel {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 12px;
  padding: 24px;
  min-width: 320px;
  max-width: 400px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  pointer-events: auto;
}

.settings-panel h3 {
  margin: 0 0 20px 0;
  color: #333;
  font-size: 18px;
  text-align: center;
}

.setting-item {
  margin-bottom: 16px;
}

.setting-item label {
  display: block;
  margin-bottom: 4px;
  color: #555;
  font-size: 14px;
  font-weight: 500;
}

.setting-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  box-sizing: border-box;
  outline: none;
  transition: border-color 0.2s;
  pointer-events: auto !important;
  -webkit-app-region: no-drag;
}

.setting-input:focus {
  border-color: #4a9eff;
}

.setting-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 20px;
}

.save-btn, .cancel-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.save-btn {
  background: #4a9eff;
  color: white;
}

.save-btn:hover {
  background: #3a8eef;
}

.cancel-btn {
  background: #f0f0f0;
  color: #666;
}

.cancel-btn:hover {
  background: #e0e0e0;
}

/* 响应式设计 */
@media (max-width: 600px) {
  .chat-bubble {
    max-width: 250px;
  }

  .bubble-content {
    font-size: 13px;
    padding: 10px 14px;
  }

  .settings-panel {
    margin: 20px;
    min-width: auto;
    width: calc(100% - 40px);
  }
}
</style>
