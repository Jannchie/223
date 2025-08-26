<!-- eslint-disable no-console -->
<script setup lang="ts">
import { useLocalStorage } from '@vueuse/core'
import { Live2DModel } from 'pixi-live2d-display-lipsyncpatch/cubism4'
import { Application, Ticker } from 'pixi.js'
import { onMounted, onUnmounted, ref } from 'vue'

// 输入框相关状态
const inputText = ref('')
const inputPositionY = ref(0)
const cursorPosition = ref({ x: 0, y: 0 })
const isInputFocused = ref(false)

// 鼠标位置状态
const mouseX = ref(0)
const mouseY = ref(0)
let model: Live2DModel | null = null
let app: Application | null = null

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
  console.log(`[setGazeTarget] 设置目标坐标: (${x}, ${y})`)
  gazeTargetX.value = x
  gazeTargetY.value = y
}

// 清除目光追踪目标，回到鼠标追踪模式
function clearGazeTarget() {
  console.log('[clearGazeTarget] 清除目光跟踪目标，恢复鼠标跟踪')
  gazeTargetX.value = null
  gazeTargetY.value = null
}

// 计算输入框光标的屏幕坐标位置
function calculateCursorPosition(inputElement: HTMLInputElement) {
  try {
    console.log('=== 开始计算光标位置 ===')

    // 获取光标位置
    const selectionStart = inputElement.selectionStart || 0
    const textBeforeCursor = inputElement.value.slice(0, Math.max(0, selectionStart))

    console.log(`光标位置: ${selectionStart}, 光标前文本: "${textBeforeCursor}"`)

    // 获取输入框的样式信息（只需要获取一次）
    const computedStyle = globalThis.getComputedStyle(inputElement)

    // 更精确的文本宽度测量
    let textWidth = 0

    try {
      // 方法1：使用 Range API 获取精确的光标位置（最准确的方法）
      if (inputElement.setSelectionRange) {
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
        mirror.style.wordWrap = 'normal'
        mirror.style.top = '10px' // 调试位置
        mirror.style.left = '10px'
        mirror.style.backgroundColor = 'rgba(255, 255, 0, 0.5)' // 黄色半透明背景
        mirror.style.border = '1px solid red' // 红色边框
        mirror.style.zIndex = '10000' // 确保显示在最上层

        // 添加光标前的文本和一个测量点
        const textNode = document.createTextNode(textBeforeCursor)
        const measureSpan = document.createElement('span')
        measureSpan.style.position = 'relative'
        measureSpan.style.backgroundColor = 'rgba(0, 255, 0, 0.5)' // 绿色背景标记测量点
        measureSpan.style.border = '1px solid blue' // 蓝色边框
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
        console.log(`Range API 测量文本宽度: ${textWidth}px`)
      }

      // 方法2：Canvas 方法作为备用
      if (textWidth === 0 || Number.isNaN(textWidth)) {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')!

        // 设置高 DPI 支持
        const ratio = globalThis.devicePixelRatio || 1
        canvas.width = 1000 * ratio
        canvas.height = 100 * ratio
        ctx.scale(ratio, ratio)

        // 复制所有相关的字体样式属性
        ctx.font = [
          computedStyle.fontStyle,
          computedStyle.fontVariant,
          computedStyle.fontWeight,
          computedStyle.fontSize,
          computedStyle.fontFamily,
        ].join(' ')

        ctx.textBaseline = 'middle'
        if (computedStyle.letterSpacing !== 'normal') {
          ctx.letterSpacing = computedStyle.letterSpacing
        }

        textWidth = ctx.measureText(textBeforeCursor).width
        console.log(`Canvas 测量文本宽度: ${textWidth}px`)
      }

      // 方法3：DOM 元素方法作为最后备用
      if (textWidth === 0 || Number.isNaN(textWidth)) {
        const tempDiv = document.createElement('div')
        tempDiv.style.position = 'absolute'
        tempDiv.style.visibility = 'hidden'
        tempDiv.style.height = 'auto'
        tempDiv.style.width = 'auto'
        tempDiv.style.whiteSpace = 'pre'

        // 复制输入框的所有字体相关样式
        const stylesToCopy = [
          'fontFamily',
          'fontSize',
          'fontWeight',
          'fontStyle',
          'letterSpacing',
          'wordSpacing',
          'textTransform',
          'lineHeight',
        ]
        for (const prop of stylesToCopy) {
          tempDiv.style[prop as any] = computedStyle[prop as any]
        }

        tempDiv.textContent = textBeforeCursor
        document.body.append(tempDiv)
        textWidth = tempDiv.getBoundingClientRect().width
        tempDiv.remove()
        console.log(`DOM 测量文本宽度: ${textWidth}px`)
      }
    }
    catch (error) {
      console.error('文本宽度测量失败:', error)
      textWidth = textBeforeCursor.length * 8 // 回退到估算值
    }

    // 获取输入框的内边距和边框
    const paddingLeft = Number.parseFloat(computedStyle.paddingLeft) || 0
    const borderLeft = Number.parseFloat(computedStyle.borderLeftWidth) || 0

    console.log(`padding-left: ${paddingLeft}px, border-left: ${borderLeft}px`)
    console.log(`最终文本宽度: ${textWidth}px`)

    // 获取输入框的实时全局位置（关键：每次都要重新获取，因为输入框会跟随模型移动）
    const currentInputRect = inputElement.getBoundingClientRect()

    console.log(`输入框实时位置: left=${currentInputRect.left}, top=${currentInputRect.top}`)
    console.log(`输入框尺寸: width=${currentInputRect.width}, height=${currentInputRect.height}`)

    // 计算光标的绝对屏幕坐标（基于实时的输入框位置）
    const rawCursorX = currentInputRect.left + paddingLeft + borderLeft + textWidth
    const absoluteCursorY = currentInputRect.top + currentInputRect.height / 2

    console.log(`光标计算过程: ${currentInputRect.left} + ${paddingLeft} + ${borderLeft} + ${textWidth} = ${rawCursorX}`)

    // 限制光标位置不超出文本框右边界
    const inputRightBoundary = currentInputRect.right - paddingLeft - borderLeft
    const absoluteCursorX = Math.min(rawCursorX, inputRightBoundary)

    console.log(`输入框右边界: ${inputRightBoundary}, 限制前光标X: ${rawCursorX}, 限制后光标X: ${absoluteCursorX}`)
    console.log(`计算出的光标绝对坐标: x=${absoluteCursorX}, y=${absoluteCursorY}`)

    const finalCursorX = absoluteCursorX
    console.log(`最终光标坐标: x=${finalCursorX}, y=${absoluteCursorY}`)

    // 使用修正后的坐标
    cursorPosition.value = { x: finalCursorX, y: absoluteCursorY }

    // 当输入框聚焦时，设置目光跟随光标位置
    if (isInputFocused.value) {
      console.log(`设置目光跟随光标: (${finalCursorX}, ${absoluteCursorY})`)
      setGazeTarget(finalCursorX, absoluteCursorY)
    }
  }
  catch (error) {
    console.error('计算光标位置时出错:', error)
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

// 输入框事件处理
function handleInputFocus(event: FocusEvent) {
  console.log('[handleInputFocus] 输入框获得焦点')
  isInputFocused.value = true
  const inputElement = event.target as HTMLInputElement
  calculateCursorPosition(inputElement)
}

function handleInputBlur() {
  console.log('[handleInputBlur] 输入框失去焦点，恢复鼠标跟踪')
  isInputFocused.value = false
  // 失去焦点时恢复到鼠标追踪模式
  clearGazeTarget()
}

function handleInputChange(event: Event) {
  const inputElement = event.target as HTMLInputElement
  if (isInputFocused.value) {
    console.log('[handleInputChange] 输入内容变化，重新计算光标位置')
    // 使用防抖函数避免频繁计算
    debouncedCalculateCursorPosition(inputElement)
  }
}

function handleInputCursorMove(event: Event) {
  const inputElement = event.target as HTMLInputElement
  if (isInputFocused.value) {
    console.log('[handleInputCursorMove] 光标位置移动')
    // 立即计算光标位置，不使用防抖
    calculateCursorPosition(inputElement)
  }
}

// 将钩子函数暴露到全局
if (typeof globalThis !== 'undefined') {
  (globalThis as any).setGazeTarget = setGazeTarget;
  (globalThis as any).clearGazeTarget = clearGazeTarget
}

// 计算输入框基于模型的位置
function calculateInputPosition() {
  if (!model || !app) {
    inputPositionY.value = (canvasHeight.value * canvasScale.value) * 0.6 // 默认回退位置
    return
  }

  try {
    // 尝试获取模型的边界信息
    const bounds = model.getBounds()
    console.log('Model bounds:', bounds)

    // 尝试获取模型参数，寻找身体相关的参数
    const internalModel = model.internalModel as any
    if (internalModel) {
      console.log('Model parameters available:')

      // 尝试不同的API来获取参数信息
      if (internalModel.parameters) {
        internalModel.parameters.forEach((param: any, index: number) => {
          if (param.id) {
            console.log(`Parameter ${index}: ${param.id}`)
          }
        })
      }
      else if (internalModel.coreModel && internalModel.coreModel.parameters) {
        for (let i = 0; i < internalModel.coreModel.getParameterCount(); i++) {
          const paramId = internalModel.coreModel.getParameterId(i)
          console.log(`Parameter ${i}: ${paramId}`)
        }
      }

      // 尝试获取可绘制对象信息（drawable）
      if (internalModel.coreModel && internalModel.coreModel.getDrawableCount) {
        const drawableCount = internalModel.coreModel.getDrawableCount()
        console.log(`Drawable count: ${drawableCount}`)

        for (let i = 0; i < Math.min(drawableCount, 10); i++) { // 只显示前10个
          try {
            const drawableId = internalModel.coreModel.getDrawableId(i)
            console.log(`Drawable ${i}: ${drawableId}`)
          }
          catch {
            // 忽略错误，继续下一个
          }
        }
      }
    }

    // 基于模型的实际高度和位置计算胸部位置
    // model.y 是模型在canvas中的位置（相对于canvas）
    const modelCenterY = model.y
    const modelHeight = model.height * model.scale.y

    console.log(`Model center Y: ${modelCenterY}, Model height: ${modelHeight}`)
    console.log(`Canvas scale: ${canvasScale.value}`)

    // 胸部通常在模型中心下方约1/6到1/4的位置，输入框放在胸部下方
    const chestRelativeY = modelCenterY + modelHeight * 0.15 // 胸部位置（相对于canvas）
    const inputOffsetY = 50 // 固定的像素偏移
    const inputRelativeY = chestRelativeY + inputOffsetY // 在胸部下方（相对于canvas）

    console.log(`Chest relative Y: ${chestRelativeY}, Input relative Y: ${inputRelativeY}`)

    // 存储相对于canvas的坐标，在模板中会加上canvasY
    inputPositionY.value = inputRelativeY
  }
  catch (error) {
    console.log('Error calculating input position:', error)
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
        console.log(`搜索眼睛 drawable，总数: ${drawableCount}`)

        for (let i = 0; i < drawableCount; i++) {
          try {
            const drawableId = internalModel.coreModel.getDrawableId(i)
            // 寻找眼睛相关的drawable（常见命名包含eye、Eye、目等）
            if (drawableId && (drawableId.includes('Eye') || drawableId.includes('eye') || drawableId.includes('目'))) {
              console.log(`找到眼睛相关 drawable: ${drawableId}`)

              // 尝试获取drawable的位置信息
              if (internalModel.coreModel.getDrawableVertexPositions) {
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

                  console.log(`从 drawable ${drawableId} 获取到眼睛坐标: 模型(${centerX.toFixed(1)}, ${centerY.toFixed(1)}) -> 屏幕(${eyeScreenX.toFixed(1)}, ${eyeScreenY.toFixed(1)})`)
                  break // 找到第一个眼睛就使用它
                }
              }
            }
          }
          catch {
            // 忽略单个drawable的错误，继续搜索
          }
        }
      }

      // 方法2：尝试从参数中推断眼睛位置
      if (eyeScreenX === canvasX.value + (canvasWidth.value * canvasScale.value) / 2) {
        // 如果还是默认位置，尝试其他方法
        console.log('未找到眼睛drawable，尝试从参数推断')

        if (internalModel.parameters) {
          internalModel.parameters.forEach((param: any, index: number) => {
            if (param.id && (param.id.includes('Eye') || param.id.includes('eye'))) {
              console.log(`找到眼睛相关参数: ${param.id}, 当前值: ${param.value}`)
            }
          })
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

    // 输出调试信息
    if (isInputFocused.value) {
      console.log(`[updateGazeParameters] ${sourceType}目标变化:`)
      console.log(`  原始坐标: (${targetScreenX}, ${targetScreenY})`)
      console.log(`  眼睛位置: (${eyeScreenX.toFixed(1)}, ${eyeScreenY.toFixed(1)})`)
      console.log(`  投影坐标: (${projectionScreenX.toFixed(1)}, ${projectionScreenY.toFixed(1)})`)
      console.log(`  模型坐标: (${modelX.toFixed(1)}, ${modelY.toFixed(1)}) - 缓动移动`)
    }
    else if (sourceType === 'Electron鼠标') {
      console.log(`[updateGazeParameters] ${sourceType}目标变化:`)
      console.log(`  原始坐标: (${targetScreenX}, ${targetScreenY})`)
      console.log(`  眼睛位置: (${eyeScreenX.toFixed(1)}, ${eyeScreenY.toFixed(1)})`)
      console.log(`  投影坐标: (${projectionScreenX.toFixed(1)}, ${projectionScreenY.toFixed(1)})`)
      console.log(`  模型坐标: (${modelX.toFixed(1)}, ${modelY.toFixed(1)}) - 缓动移动`)
    }
    // 本地鼠标移动太频繁，不输出日志
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
      // 重新计算输入框位置
      calculateInputPosition()
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

    // 启动目光追踪更新循环
    app.ticker.add(updateGazeParameters)

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
    <div
      class="input-container"
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
        placeholder="请输入内容..."
        class="text-input"
        @focus="handleInputFocus"
        @blur="handleInputBlur"
        @input="handleInputChange"
        @keyup="handleInputCursorMove"
        @click="handleInputCursorMove"
        @keydown="handleInputCursorMove"
        @select="handleInputCursorMove"
      >
    </div>
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

.input-container {
  position: absolute;
  z-index: 100;
  display: flex;
  justify-content: center;
  -webkit-app-region: no-drag;
  pointer-events: auto;
}

.text-input {
  padding: 12px 16px;
  width: 100%;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
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
</style>
