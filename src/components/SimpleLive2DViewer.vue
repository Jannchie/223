<!-- eslint-disable no-console -->
<script setup lang="ts">
import type { Character } from '../types/chat'
import type { RoastStyle } from '../utils/screenshot-prompts'
import type { RoastResult, ScreenshotRoastConfig } from '../utils/screenshot-roast'
import { Live2DModel } from '@jannchie/pixi-live2d-display'
import { useLocalStorage } from '@vueuse/core'
import { Application, Ticker } from 'pixi.js'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useChatCompatible } from '../composables/useChat'
import { characterService } from '../services/character-service'
import { chatService } from '../services/chat-service'
import { getRoastPrompt } from '../utils/screenshot-prompts'
import { RoastHistoryManager, ScreenshotRoastManager } from '../utils/screenshot-roast'
import CharacterEditor from './CharacterEditor.vue'
import CharacterSelector from './CharacterSelector.vue'

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

// 聊天功能集成
const {
  isTyping: chatIsTyping,
  currentResponse: chatCurrentResponse,
  error: chatError,
  config: chatConfig,
  sendMessage: chatSendMessage,
  updateConfig,
} = useChatCompatible()

// 兼容旧版本的状态映射
const apiKey = computed({
  get: () => chatConfig.value.apiKey,
  set: (value: string) => updateConfig({ apiKey: value }),
})
const baseURL = computed({
  get: () => chatConfig.value.baseURL || 'https://api.openai.com/v1',
  set: (value: string) => updateConfig({ baseURL: value }),
})
const showSettings = ref(false)

// 人设管理相关状态
const currentCharacter = ref<Character | null>(null)
const activeSettingsTab = ref<'openai' | 'character' | 'roast' | 'recording' | 'gaze'>('openai')
const isRecordingWindowOpen = ref(false)
const isInRecordingWindow = ref(false)
const showCharacterEditor = ref(false)
const editingCharacter = ref<Character | null>(null)

// 保存最后选择的角色ID和模型路径
const lastSelectedCharacterId = useLocalStorage<string | null>('last-selected-character-id', null)
const lastUsedModelPath = useLocalStorage<string | null>('last-used-model-path', null)
const characterEditorMode = ref<'create' | 'edit'>('create')
const characterSelectorRef = ref<InstanceType<typeof CharacterSelector> | null>(null)

// 截图吐槽相关状态
const screenshotRoastManager = ref<ScreenshotRoastManager | null>(null)
const roastHistoryManager = new RoastHistoryManager()
const roastConfig = useLocalStorage<ScreenshotRoastConfig>('screenshot-roast-config', {
  enabled: false,
  interval: 5,
  style: 'default',
  autoTrigger: false,
})
const currentRoast = ref<RoastResult | null>(null)
const isRoasting = ref(false)
const roastHistory = ref<RoastResult[]>([])
const showRoastBubble = ref(false)
const roastBubbleContent = ref('')

// 映射聊天状态到旧版本变量
watch(chatIsTyping, (newValue) => {
  isTyping.value = newValue
})

watch(chatCurrentResponse, (newValue) => {
  currentResponse.value = newValue
  if (newValue) {
    showBubble.value = true
    bubbleContent.value = newValue
    updateBubblePosition()
  }
})

watch(chatError, (error) => {
  if (error) {
    showTemporaryBubble(`错误: ${error}`)
  }
})

// 监听聊天完成，显示最终消息
watch(chatIsTyping, (isTyping) => {
  if (!isTyping && chatCurrentResponse.value) {
    // 聊天结束，显示最终消息
    showBubble.value = true
    bubbleContent.value = chatCurrentResponse.value
    updateBubblePosition()
  }
})

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

// 定期目光锁定相关状态
const gazeAtUserConfig = useLocalStorage('gaze-at-user-config', {
  enabled: true, // 是否启用定期目光锁定
  intervalMinutes: 1, // 基础间隔分钟数
  lockDurationSeconds: 3, // 基础锁定持续时间（秒）
  randomizeInterval: true, // 是否随机化间隔时间
  randomizeDuration: true, // 是否随机化锁定时间
  randomOffset: true, // 是否添加随机偏移（保留但暂时不用）
})
const gazeAtUserTimer = ref<NodeJS.Timeout | null>(null)
const isGazingAtUser = ref(false)

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

// 初始化聊天服务
function initializeChatService() {
  if (apiKey.value) {
    try {
      updateConfig({
        apiKey: apiKey.value,
        baseURL: baseURL.value,
      })
      // 显示欢迎消息，使用当前角色名称
      const characterName = currentCharacter.value?.name || '06娘'
      showTemporaryBubble(`嗨~我是${characterName}！快来和我聊天吧~`, 4000)
    }
    catch {
      // 忽略错误
    }
  }
  else {
    // 如果没有配置API Key，显示提示消息
    showTemporaryBubble('点击下方的设置按钮配置API Key就可以和我聊天啦~', 6000)
  }
}

// 发送消息
async function sendMessage() {
  const content = inputText.value.trim()
  if (!content || isTyping.value) {
    return
  }

  if (!apiKey.value) {
    showTemporaryBubble('请先配置 OpenAI API Key')
    return
  }

  // 清空输入框
  inputText.value = ''

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
    await chatSendMessage(content)

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
  }
  catch (error) {
    console.error('发送消息失败:', error)
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

// 计算用户位置（屏幕中心）
function getUserPosition(): { x: number, y: number } {
  // 简单地返回屏幕中心作为"用户位置"
  return {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  }
}

// 获取随机化的间隔时间（毫秒）
function getRandomizedInterval(): number {
  const baseIntervalMs = gazeAtUserConfig.value.intervalMinutes * 60 * 1000

  if (!gazeAtUserConfig.value.randomizeInterval) {
    return baseIntervalMs
  }

  // 在基础时间的 50%-150% 之间随机
  const randomFactor = 0.5 + Math.random() * 1 // 0.5 到 1.5
  return Math.round(baseIntervalMs * randomFactor)
}

// 获取随机化的锁定持续时间（毫秒）
function getRandomizedDuration(): number {
  const baseDurationMs = gazeAtUserConfig.value.lockDurationSeconds * 1000

  if (!gazeAtUserConfig.value.randomizeDuration) {
    return baseDurationMs
  }

  // 在基础时间的 70%-130% 之间随机
  const randomFactor = 0.7 + Math.random() * 0.6 // 0.7 到 1.3
  return Math.round(baseDurationMs * randomFactor)
}

// 开始目光锁定用户
function startGazeAtUser() {
  if (!gazeAtUserConfig.value.enabled || isGazingAtUser.value || !model) {
    return
  }

  try {
    const modelWithEyesLock = model as any

    // 检查模型是否支持眼睛锁定功能
    if (modelWithEyesLock.setEyesAlwaysLookAtCamera) {
      isGazingAtUser.value = true

      // 启用眼睛锁定到摄像头
      modelWithEyesLock.setEyesAlwaysLookAtCamera(true)

      // 在随机化的时间后停止锁定
      const lockDuration = getRandomizedDuration()
      setTimeout(() => {
        stopGazeAtUser()
      }, lockDuration)
    }
    else {
      console.warn('此Live2D模型不支持眼睛锁定功能')
    }
  }
  catch (error) {
    console.error('启动目光锁定失败:', error)
    isGazingAtUser.value = false
  }
}

// 停止目光锁定用户
function stopGazeAtUser() {
  if (!isGazingAtUser.value || !model) {
    return
  }

  try {
    const modelWithEyesLock = model as any

    // 检查并禁用眼睛锁定
    if (modelWithEyesLock.setEyesAlwaysLookAtCamera
        && modelWithEyesLock.isEyesAlwaysLookAtCamera
        && modelWithEyesLock.isEyesAlwaysLookAtCamera()) {
      modelWithEyesLock.setEyesAlwaysLookAtCamera(false)
    }

    isGazingAtUser.value = false
  }
  catch (error) {
    console.error('停止目光锁定失败:', error)
    isGazingAtUser.value = false
  }
}

// 启动定期目光锁定计时器
function startGazeAtUserTimer() {
  if (!gazeAtUserConfig.value.enabled) {
    return
  }

  stopGazeAtUserTimer() // 先清除已有的计时器

  // 使用递归setTimeout而不是setInterval，以便每次都能重新计算随机间隔
  scheduleNextGaze()
}

// 安排下一次目光锁定
function scheduleNextGaze() {
  if (!gazeAtUserConfig.value.enabled) {
    return
  }

  const intervalMs = getRandomizedInterval()

  gazeAtUserTimer.value = setTimeout(() => {
    // 只有在没有其他交互时才执行定期锁定
    if (!isInputFocused.value && !showSettings.value && !isTyping.value) {
      startGazeAtUser()
    }

    // 安排下一次锁定（递归调用）
    scheduleNextGaze()
  }, intervalMs)
}

// 停止定期目光锁定计时器
function stopGazeAtUserTimer() {
  if (gazeAtUserTimer.value) {
    clearTimeout(gazeAtUserTimer.value)
    gazeAtUserTimer.value = null
  }
  stopGazeAtUser() // 同时停止当前的锁定
}

// 更新目光锁定配置
function updateGazeAtUserConfig(newConfig: Partial<typeof gazeAtUserConfig.value>) {
  gazeAtUserConfig.value = { ...gazeAtUserConfig.value, ...newConfig }

  // 重新启动计时器以应用新配置
  if (gazeAtUserConfig.value.enabled) {
    startGazeAtUserTimer()
  }
  else {
    stopGazeAtUserTimer()
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
    // 如果模型仍然存在，尝试使用基本属性估算
    if (model && model.x !== undefined) {
      const modelCenterX = canvasX.value + model.x
      const modelTop = canvasY.value + model.y - (model.height * model.scale.y) / 2

      return {
        x: modelCenterX,
        y: modelTop,
      }
    }
    
    // 最终回退位置：canvas中心顶部
    return {
      x: canvasX.value + (canvasWidth.value * canvasScale.value) / 2,
      y: canvasY.value,
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

  // 如果正在使用Live2D内置眼睛锁定功能，跳过常规目光追踪
  if (isGazingAtUser.value) {
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
                let centerX = 0
                let centerY = 0
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
  // 检查是否在设置面板区域
  const inSettings = isPointInSettings(clientX, clientY)
  return inCanvas || inInput || inSettings
}

// 控制鼠标穿透的函数
function setMouseEventTransparency(shouldIgnore: boolean) {
  if ((globalThis as any).electronAPI && (globalThis as any).electronAPI.setIgnoreMouseEvents) {
    (globalThis as any).electronAPI.setIgnoreMouseEvents({
      ignore: shouldIgnore,
      forward: true,
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

// 检查点击是否在设置面板区域内
function isPointInSettings(clientX: number, clientY: number): boolean {
  if (!showSettings.value) {
    return false
  }

  const settingsOverlay = document.querySelector('.settings-overlay') as HTMLElement
  if (!settingsOverlay) {
    return false
  }

  const rect = settingsOverlay.getBoundingClientRect()
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
  initializeChatService()
  showSettings.value = false
  showTemporaryBubble('设置已保存')
}

// 取消设置
function cancelSettings() {
  showSettings.value = false
}

// 获取模型文件路径（支持本地和远程URL）
function getModelURL(modelPath = '06-v2.1024/06-v2.model3.json') {
  // 如果是完整的 URL（以 http 或 https 开头），直接返回
  if (modelPath.startsWith('http://') || modelPath.startsWith('https://')) {
    return modelPath
  }

  const model_path = modelPath

  // 在 Electron 环境中使用自定义协议
  if ((globalThis as any).electronAPI && (globalThis as any).electronAPI.getModelPath) {
    return (globalThis as any).electronAPI.getModelPath(model_path)
  }

  // 在开发环境或浏览器中使用相对路径
  return `/models/${model_path}`
}

// 人设管理相关方法
async function loadCurrentCharacter() {
  try {
    // 优先加载上次选择的角色
    let targetCharacter: Character | null = null
    
    if (lastSelectedCharacterId.value) {
      console.log('尝试加载上次选择的角色:', lastSelectedCharacterId.value)
      // 确保ID类型匹配：先尝试字符串，再尝试数字
      targetCharacter = await characterService.getCharacter(lastSelectedCharacterId.value)
      
      if (!targetCharacter && !isNaN(Number(lastSelectedCharacterId.value))) {
        // 如果字符串查找失败，尝试数字查找
        console.log('尝试数字ID查找:', Number(lastSelectedCharacterId.value))
        targetCharacter = await characterService.getCharacter(Number(lastSelectedCharacterId.value) as any)
      }
      
      if (!targetCharacter) {
        console.log('上次选择的角色不存在，重置选择')
        lastSelectedCharacterId.value = null
        lastUsedModelPath.value = null
      }
    }
    
    // 如果没有上次选择的角色，使用角色服务的当前角色
    if (!targetCharacter) {
      targetCharacter = await characterService.getCurrentCharacterAsync()
    }
    
    currentCharacter.value = targetCharacter
    
    // 更新保存的选择
    if (targetCharacter) {
      lastSelectedCharacterId.value = targetCharacter.id.toString()
      if (targetCharacter.modelPath) {
        lastUsedModelPath.value = targetCharacter.modelPath
      }
      
      console.log('当前角色:', targetCharacter.name, '模型路径:', targetCharacter.modelPath)
    }
  }
  catch (error) {
    console.error('加载当前角色失败:', error)
  }
}

function handleCharacterSelect(character: Character) {
  switchCharacter(character)
}

function handleCharacterEdit(character: Character) {
  editingCharacter.value = character
  characterEditorMode.value = 'edit'
  showCharacterEditor.value = true
}

async function handleCharacterDelete(character: Character) {
  try {
    await characterService.deleteCharacter(character.id)
    characterSelectorRef.value?.refresh()

    // 如果删除的是当前角色，切换到第一个可用角色
    if (currentCharacter.value?.id === character.id) {
      const characters = await characterService.getAllCharacters()
      if (characters.length > 0) {
        await switchCharacter(characters[0])
      }
    }

    showTemporaryBubble(`已删除角色 "${character.name}"`)
  }
  catch (error) {
    console.error('删除角色失败:', error)
    showTemporaryBubble(`删除角色失败: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function handleCharacterCreate() {
  editingCharacter.value = null
  characterEditorMode.value = 'create'
  showCharacterEditor.value = true
}

async function handleCharacterSave(character: Character) {
  showCharacterEditor.value = false
  characterSelectorRef.value?.refresh()

  // 如果保存的是当前角色或者是新创建的角色，切换到该角色
  if (!currentCharacter.value || character.id === currentCharacter.value.id || characterEditorMode.value === 'create') {
    await switchCharacter(character)
  } else {
    // 如果编辑的不是当前角色，但用户可能想切换到编辑的角色
    // 更新保存记录（如果用户之后手动选择这个角色，会记住新的设置）
    if (character.modelPath) {
      console.log('更新角色模型路径记录:', character.name, character.modelPath)
    }
  }

  showTemporaryBubble(`角色 "${character.name}" 已保存`)
}

function handleCharacterEditorCancel() {
  showCharacterEditor.value = false
  editingCharacter.value = null
}

async function handleCharacterEditorDelete(character: Character) {
  showCharacterEditor.value = false
  editingCharacter.value = null
  await handleCharacterDelete(character)
}

// 切换角色
async function switchCharacter(character: Character) {
  try {
    await characterService.setCurrentCharacter(character.id)
    currentCharacter.value = character

    // 保存最后选择的角色和模型路径（确保ID为字符串格式）
    lastSelectedCharacterId.value = character.id.toString()
    if (character.modelPath) {
      lastUsedModelPath.value = character.modelPath
    }
    
    console.log('保存角色选择:', character.name, 'ID:', character.id.toString())

    // 重新加载 Live2D 模型
    if (character.modelPath) {
      await loadLive2DModel(character.modelPath)
    }

    // 重新初始化聊天服务以使用新的角色设定
    initializeChatService()

    showTemporaryBubble(`已切换到角色 "${character.name}"`)
  }
  catch (error) {
    console.error('切换角色失败:', error)
    showTemporaryBubble(`切换角色失败: ${error instanceof Error ? error.message : String(error)}`)
  }
}

// 加载 Live2D 模型
async function loadLive2DModel(modelPath: string) {
  if (!app) {
    return
  }

  try {
    // 移除旧模型
    if (model) {
      app.stage.removeChild(model)
      model.destroy()
    }

    const modelURL = getModelURL(modelPath)
    console.log('Loading model from:', modelURL)

    // 加载新模型
    model = await Live2DModel.from(modelURL, {
      ticker: Ticker.shared,
    })

    console.log('Model loaded successfully')
    model.setRenderer(app.renderer)
    
    // 确保模型背景透明
    if (model.internalModel && model.internalModel.renderer) {
      // 设置 Live2D 模型渲染器的透明度
      model.internalModel.renderer.setMvpMatrix(model.internalModel.renderer._mvpMatrix)
    }
    
    app.stage.addChild(model)

    // 设置模型显示
    const initialWidth = canvasWidth.value
    const initialHeight = canvasHeight.value

    model.anchor.set(0.5, 0.5)
    model.position.set(initialWidth / 2, initialHeight / 2)
    baseModelScale = Math.min(initialWidth / model.width, initialHeight / model.height) * 0.8
    model.scale.set(baseModelScale * canvasScale.value, baseModelScale * canvasScale.value)

    // 重新计算输入框位置
    calculateInputPosition()

    // 将模型设为全局变量，方便外部访问
    if (typeof globalThis !== 'undefined') {
      (globalThis as any).live2dModel = model
    }
  }
  catch (error) {
    console.error('模型加载失败:', error)
    showTemporaryBubble(`模型加载失败: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function switchSettingsTab(tab: 'openai' | 'character' | 'roast' | 'recording' | 'gaze') {
  activeSettingsTab.value = tab
}

// 打开录制窗口
async function openRecordingWindow() {
  try {
    if (globalThis.electronAPI?.openRecordingWindow) {
      const success = await globalThis.electronAPI.openRecordingWindow()
      if (success) {
        isRecordingWindowOpen.value = true
        showTemporaryBubble('录制窗口已打开')
      }
    }
  }
  catch (error) {
    console.error('打开录制窗口失败:', error)
    showTemporaryBubble('打开录制窗口失败')
  }
}

// 关闭录制窗口
async function closeRecordingWindow() {
  try {
    if (globalThis.electronAPI?.closeRecordingWindow) {
      const success = await globalThis.electronAPI.closeRecordingWindow()
      if (success) {
        isRecordingWindowOpen.value = false
        showTemporaryBubble('录制窗口已关闭')
      }
    }
  }
  catch (error) {
    console.error('关闭录制窗口失败:', error)
    showTemporaryBubble('关闭录制窗口失败')
  }
}

// 切换录制窗口
async function toggleRecordingWindow() {
  await (isRecordingWindowOpen.value ? closeRecordingWindow() : openRecordingWindow())
}

// 初始化截图吐槽管理器
function initScreenshotRoastManager() {
  if (!screenshotRoastManager.value) {
    const streamingCallbacks = {
      onStart: handleRoastStart,
      onToken: handleRoastToken,
      onComplete: handleRoastResult,
      onError: handleRoastError,
    }

    screenshotRoastManager.value = new ScreenshotRoastManager(
      chatConfig.value,
      handleRoastResult,
      handleRoastError,
      streamingCallbacks,
      roastHistoryManager,
    )
    screenshotRoastManager.value.updateConfig(roastConfig.value)
  }
}

// 开始流式显示吐槽
function handleRoastStart() {
  showRoastBubble.value = true
  roastBubbleContent.value = ''
}

// 处理流式吐槽 token
function handleRoastToken(token: string) {
  roastBubbleContent.value += token
}

// 处理吐槽结果
function handleRoastResult(result: RoastResult) {
  currentRoast.value = result
  // 不再在这里添加到历史记录，由 ScreenshotRoastManager 内部处理
  roastHistory.value = roastHistoryManager.getHistory()

  // 确保最终内容正确
  roastBubbleContent.value = result.text

  // 5秒后隐藏
  setTimeout(() => {
    showRoastBubble.value = false
  }, 5000)
}

// 处理吐槽错误
function handleRoastError(error: string) {
  showTemporaryBubble(`吐槽失败: ${error}`)
}

// 手动触发吐槽
async function triggerManualRoast() {
  if (!screenshotRoastManager.value) {
    initScreenshotRoastManager()
  }

  isRoasting.value = true

  try {
    await screenshotRoastManager.value!.triggerRoast()
  }
  catch (error) {
    console.error('手动吐槽失败:', error)
  }
  finally {
    isRoasting.value = false
  }
}

// 更新吐槽配置
function updateRoastConfig(newConfig: Partial<ScreenshotRoastConfig>) {
  roastConfig.value = { ...roastConfig.value, ...newConfig }

  if (screenshotRoastManager.value) {
    screenshotRoastManager.value.updateConfig(roastConfig.value)
  }
}

// 切换自动吐槽
function toggleAutoRoast() {
  updateRoastConfig({
    enabled: !roastConfig.value.enabled,
    autoTrigger: !roastConfig.value.enabled,
  })
}

// 设置吐槽间隔
function setRoastInterval(minutes: number) {
  updateRoastConfig({ interval: minutes })
}

// 设置吐槽风格
function setRoastStyle(style: RoastStyle) {
  updateRoastConfig({ style })
}

// 清空吐槽历史
function clearRoastHistory() {
  roastHistoryManager.clearHistory()
  roastHistory.value = []
  currentRoast.value = null
}

// 处理快捷键触发的截图吐槽
async function handleHotkeyScreenshotRoast(screenshot: string) {
  if (isRoasting.value) {
    showTemporaryBubble('吐槽正在进行中，请稍后...')
    return
  }

  if (!screenshotRoastManager.value) {
    initScreenshotRoastManager()
  }

  // F7 快捷键静默触发，不显示提示

  // 直接生成吐槽，使用现有的 generateRoast 逻辑
  isRoasting.value = true
  handleRoastStart() // 开始流式显示

  try {
    const prompt = getRoastPrompt(roastConfig.value.style)
    const roastText = '你是一个桌面 ai，正在和用户一起观看屏幕。请对屏幕内容，进行吐槽，不要使用 emoji！'

    const callbacks = {
      onToken: (token: string) => {
        handleRoastToken(token) // 流式显示token
      },
      onComplete: (content: string) => {
        const result = {
          text: content,
          timestamp: Date.now(),
        }
        handleRoastResult(result)
      },
      onError: (error: string) => {
        handleRoastError(`吐槽生成失败: ${error}`)
      },
    }

    // 使用 chatService 发送图片消息
    await chatService.sendMessageWithImage(
      roastText,
      screenshot,
      chatConfig.value,
      prompt,
      callbacks,
    )
  }
  catch (error) {
    console.error('吐槽失败:', error)
    handleRoastError('吐槽失败')
  }
  finally {
    isRoasting.value = false
  }
}

function handleGlobalMouseMove(event: MouseEvent) {
  // 更新鼠标位置
  mouseX.value = event.clientX
  mouseY.value = event.clientY

  // 检查是否应该显示输入框和控制鼠标穿透
  const shouldShowInput = checkMouseInInteractiveArea(event.clientX, event.clientY)
  isInputVisible.value = shouldShowInput

  // 根据是否在交互区域控制鼠标穿透
  setMouseEventTransparency(!shouldShowInput)
}

// 监听窗口大小变化
function handleResize() {
  windowHeight.value = window.innerHeight
}

onMounted(async () => {
  // 初始化人设服务并加载当前角色
  try {
    await characterService.initialize()
    await loadCurrentCharacter()
    
    // 角色加载完成后初始化聊天服务（这样欢迎消息会显示正确的角色名）
    initializeChatService()
  }
  catch (error) {
    console.error('人设服务初始化失败:', error)
    // 即使角色加载失败，也要初始化聊天服务
    initializeChatService()
  }

  // 获取录制窗口状态
  try {
    if (globalThis.electronAPI?.getRecordingWindowStatus) {
      isRecordingWindowOpen.value = await globalThis.electronAPI.getRecordingWindowStatus()
    }
  }
  catch (error) {
    console.error('获取录制窗口状态失败:', error)
  }

  // 检查当前是否为录制窗口
  const urlParams = new URLSearchParams(globalThis.location.search)
  isInRecordingWindow.value = urlParams.get('recording') === 'true'

  // 监听录制模式设置
  if (globalThis.electronAPI?.onSetRecordingMode) {
    globalThis.electronAPI.onSetRecordingMode((isRecording) => {
      isInRecordingWindow.value = isRecording
    })
  }

  // 初始化截图吐槽管理器
  initScreenshotRoastManager()

  // 加载吐槽历史
  roastHistory.value = roastHistoryManager.getHistory()

  // 监听快捷键截图吐槽事件
  if ((globalThis as any).electronAPI?.onHotkeyScreenshotRoast) {
    (globalThis as any).electronAPI.onHotkeyScreenshotRoast(handleHotkeyScreenshotRoast)
  }

  window.addEventListener('resize', handleResize)

  // 只在设置面板显示时监听全局鼠标事件
  const watchSettings = () => {
    if (showSettings.value) {
      document.addEventListener('mousemove', handleGlobalMouseMove, { passive: true })
    }
    else {
      document.removeEventListener('mousemove', handleGlobalMouseMove)
    }
  }

  // 监听 showSettings 变化
  watch(showSettings, watchSettings, { immediate: true })

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
    backgroundColor: 0x000000, // 设置透明背景色
    clearBeforeRender: false, // 不清除背景
    powerPreference: 'high-performance', // 使用高性能 GPU
    antialias: false, // 关闭抗锯齿以提升性能
  })
  // 限制帧率为 60fps 以平衡性能和流畅度
  Ticker.shared.maxFPS = 60
  // 移除不必要的 minFPS 设置

  // 使用当前角色的模型路径，如果没有则使用默认路径
  const modelPath = currentCharacter.value?.modelPath || '06-v2.1024/06-v2.model3.json'
  const modelURL = getModelURL(modelPath)
  console.log('Loading model from:', modelURL)

  // 带重试的模型加载，以防服务器还未准备好
  let retries = 3
  while (retries > 0) {
    try {
      model = await Live2DModel.from(modelURL, {
        ticker: Ticker.shared,
      })
      console.log('Model loaded successfully')
      model.setRenderer(app.renderer)
      app.stage.addChild(model)
      break
    }
    catch (error) {
      console.error(`Model loading failed, retries left: ${retries - 1}`, error)
      retries--
      if (retries === 0) {
        throw error
      }
      // 等待 1 秒后重试
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  // 将模型设为全局变量，方便外部访问
  if (typeof globalThis !== 'undefined') {
    (globalThis as any).live2dModel = model
  }
  if (model) {
    // 设置模型显示
    model.anchor.set(0.5, 0.5)
    model.position.set(initialWidth / 2, initialHeight / 2)
    baseModelScale = Math.min(initialWidth / model.width, initialHeight / model.height) * 0.8
    // 确保模型在可视范围内
    model.scale.set(baseModelScale, baseModelScale)
  }

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
      // 如果输入框聚焦中或正在锁定用户，忽略鼠标位置事件
      if (!isInputFocused.value && !isGazingAtUser.value) {
        setGazeTarget(position.x, position.y)
      }
    })
  }

  // 启动定期目光锁定计时器
  startGazeAtUserTimer()
})

// 组件卸载时清理事件监听器
onUnmounted(() => {
  if ((globalThis as any).electronAPI && (globalThis as any).electronAPI.removeMousePositionListener) {
    (globalThis as any).electronAPI.removeMousePositionListener()
  }

  // 清理截图监听器
  if ((globalThis as any).electronAPI && (globalThis as any).electronAPI.removeScreenshotListeners) {
    (globalThis as any).electronAPI.removeScreenshotListeners()
  }

  // 清理截图吐槽管理器
  if (screenshotRoastManager.value) {
    screenshotRoastManager.value.destroy()
    screenshotRoastManager.value = null
  }

  // 清理全局鼠标事件监听器
  document.removeEventListener('mousemove', handleMouseMove)
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
  window.removeEventListener('resize', handleResize)

  // 清理定期目光锁定计时器
  stopGazeAtUserTimer()
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
        <div class="i-carbon-settings text-18px" />
      </button>
    </div>

    <!-- 对话气泡 -->
    <div
      v-if="showBubble"
      class="chat-bubble"
      :style="{
        left: `${bubblePositionX}px`,
        top: `${bubblePositionY}px`,
        transform: `translate(-50%, -100%) scale(${canvasScale})`,
      }"
    >
      <div class="bubble-content">
        {{ bubbleContent }}
      </div>
      <div class="bubble-arrow" />
    </div>

    <!-- 吐槽气泡 -->
    <div
      v-if="showRoastBubble"
      class="roast-bubble"
      :style="{
        left: `${bubblePositionX}px`,
        top: `${bubblePositionY - 20}px`,
        transform: `translate(-50%, -100%) scale(${canvasScale})`,
        opacity: roastBubbleContent.trim() ? 1 : 0,
      }"
    >
      <div class="roast-bubble-content">
        {{ roastBubbleContent }}
      </div>
      <div class="roast-bubble-arrow" />
    </div>
  </div>

  <!-- 设置面板 - 独立于主容器 -->
  <teleport to="body">
    <div v-if="showSettings" class="settings-overlay" @click="cancelSettings">
      <div class="settings-panel" @click.stop @keydown.stop @keyup.stop @keypress.stop>
        <!-- 标签导航 -->
        <div class="settings-tabs">
          <button
            class="tab-button"
            :class="{ active: activeSettingsTab === 'character' }"
            @click="switchSettingsTab('character')"
          >
            角色管理
          </button>
          <button
            class="tab-button"
            :class="{ active: activeSettingsTab === 'openai' }"
            @click="switchSettingsTab('openai')"
          >
            OpenAI 设置
          </button>
          <button
            class="tab-button"
            :class="{ active: activeSettingsTab === 'roast' }"
            @click="switchSettingsTab('roast')"
          >
            截图吐槽
          </button>
          <button
            class="tab-button"
            :class="{ active: activeSettingsTab === 'recording' }"
            @click="switchSettingsTab('recording')"
          >
            录制窗口
          </button>
          <button
            class="tab-button"
            :class="{ active: activeSettingsTab === 'gaze' }"
            @click="switchSettingsTab('gaze')"
          >
            目光跟踪
          </button>
        </div>

        <!-- 角色管理标签页 -->
        <div v-if="activeSettingsTab === 'character'" class="tab-content">
          <h3>角色管理</h3>
          <CharacterSelector
            ref="characterSelectorRef"
            :current-character-id="currentCharacter?.id?.toString() || null"
            @select="handleCharacterSelect"
            @edit="handleCharacterEdit"
            @delete="handleCharacterDelete"
            @create="handleCharacterCreate"
          />
        </div>

        <!-- OpenAI 设置标签页 -->
        <div v-if="activeSettingsTab === 'openai'" class="tab-content">
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

        <!-- 截图吐槽标签页 -->
        <div v-if="activeSettingsTab === 'roast'" class="tab-content">
          <h3>截图吐槽设置</h3>

          <!-- 功能开关 -->
          <div class="setting-item">
            <label>启用自动吐槽:</label>
            <button
              class="toggle-btn"
              :class="{ active: roastConfig.enabled }"
              @click="toggleAutoRoast"
            >
              {{ roastConfig.enabled ? '已开启' : '已关闭' }}
            </button>
          </div>

          <!-- 吐槽间隔 -->
          <div class="setting-item">
            <label>吐槽间隔（分钟）:</label>
            <select
              :value="roastConfig.interval"
              class="setting-select"
              @change="setRoastInterval(Number(($event.target as HTMLSelectElement).value))"
            >
              <option value="1">
                1 分钟
              </option>
              <option value="3">
                3 分钟
              </option>
              <option value="5">
                5 分钟
              </option>
              <option value="10">
                10 分钟
              </option>
              <option value="15">
                15 分钟
              </option>
              <option value="30">
                30 分钟
              </option>
              <option value="60">
                60 分钟
              </option>
            </select>
          </div>

          <!-- 吐槽风格 -->
          <div class="setting-item">
            <label>吐槽风格:</label>
            <select
              :value="roastConfig.style"
              class="setting-select"
              @change="setRoastStyle(($event.target as HTMLSelectElement).value as RoastStyle)"
            >
              <option value="default">
                默认 - 幽默风趣
              </option>
              <option value="gentle">
                温柔 - 温暖关怀
              </option>
              <option value="savage">
                毒舌 - 犀利直白
              </option>
              <option value="professional">
                专业 - 建设性建议
              </option>
            </select>
          </div>

          <!-- 手动触发 -->
          <div class="setting-item">
            <label>手动触发:</label>
            <div class="manual-trigger-group">
              <button
                class="action-btn"
                :disabled="isRoasting"
                @click="triggerManualRoast"
              >
                {{ isRoasting ? '正在吐槽...' : '立即吐槽' }}
              </button>
              <div class="hotkey-tip">
                <span class="hotkey-label">快捷键:</span>
                <kbd class="hotkey-kbd">F7</kbd>
              </div>
            </div>
          </div>

          <!-- 当前吐槽 -->
          <div v-if="currentRoast" class="current-roast">
            <h4>最新吐槽</h4>
            <div class="roast-content">
              {{ currentRoast.text }}
            </div>
            <div class="roast-time">
              {{ new Date(currentRoast.timestamp).toLocaleString() }}
            </div>
          </div>

          <!-- 历史记录 -->
          <div v-if="roastHistory.length > 0" class="roast-history">
            <div class="history-header">
              <h4>历史记录</h4>
              <button class="clear-btn" @click="clearRoastHistory">
                清空
              </button>
            </div>
            <div class="history-list">
              <div
                v-for="roast in roastHistory.slice(0, 5)"
                :key="roast.timestamp"
                class="history-item"
              >
                <div class="history-content">
                  {{ roast.text }}
                </div>
                <div class="history-time">
                  {{ new Date(roast.timestamp).toLocaleString() }}
                </div>
              </div>
            </div>
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

        <!-- 录制窗口标签页 -->
        <div v-if="activeSettingsTab === 'recording'" class="tab-content">
          <h3>录制窗口设置</h3>
          <div class="setting-item">
            <label>录制窗口:</label>
            <div class="recording-mode-info">
              <p class="mode-description">
                {{ isRecordingWindowOpen ? '录制窗口已打开，可供OBS等录制软件捕获' : '录制窗口已关闭' }}
              </p>
              <button
                class="toggle-btn"
                :class="{ active: isRecordingWindowOpen }"
                @click="toggleRecordingWindow"
              >
                {{ isRecordingWindowOpen ? '关闭录制窗口' : '打开录制窗口' }}
              </button>
            </div>
          </div>

          <div class="setting-item">
            <div class="recording-tips">
              <h4>使用说明:</h4>
              <ul>
                <li>主窗口：保持透明，适合日常使用和交互</li>
                <li>录制窗口：独立窗口，带有背景色，专供录制软件捕获</li>
                <li>两个窗口显示相同的Live2D角色，互不干扰</li>
                <li>可以同时使用主窗口进行交互，用录制窗口进行直播/录制</li>
                <li>也可通过系统托盘右键菜单快速操作</li>
              </ul>
            </div>
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

        <!-- 目光跟踪标签页 -->
        <div v-if="activeSettingsTab === 'gaze'" class="tab-content">
          <h3>目光跟踪设置</h3>

          <!-- 定期锁定用户功能开关 -->
          <div class="setting-item">
            <label>定期目光锁定:</label>
            <button
              class="toggle-btn"
              :class="{ active: gazeAtUserConfig.enabled }"
              @click="updateGazeAtUserConfig({ enabled: !gazeAtUserConfig.enabled })"
            >
              {{ gazeAtUserConfig.enabled ? '已开启' : '已关闭' }}
            </button>
            <p class="setting-description">
              角色会定期看向用户，增加互动感
            </p>
          </div>

          <!-- 锁定间隔设置 -->
          <div class="setting-item">
            <label>锁定间隔（分钟）:</label>
            <select
              :value="gazeAtUserConfig.intervalMinutes"
              class="setting-select"
              :disabled="!gazeAtUserConfig.enabled"
              @change="updateGazeAtUserConfig({ intervalMinutes: Number(($event.target as HTMLSelectElement).value) })"
            >
              <option value="0.5">
                30 秒
              </option>
              <option value="1">
                1 分钟
              </option>
              <option value="2">
                2 分钟
              </option>
              <option value="3">
                3 分钟
              </option>
              <option value="5">
                5 分钟
              </option>
              <option value="10">
                10 分钟
              </option>
            </select>
          </div>

          <!-- 锁定持续时间设置 -->
          <div class="setting-item">
            <label>锁定持续时间（秒）:</label>
            <select
              :value="gazeAtUserConfig.lockDurationSeconds"
              class="setting-select"
              :disabled="!gazeAtUserConfig.enabled"
              @change="updateGazeAtUserConfig({ lockDurationSeconds: Number(($event.target as HTMLSelectElement).value) })"
            >
              <option value="1">
                1 秒
              </option>
              <option value="2">
                2 秒
              </option>
              <option value="3">
                3 秒
              </option>
              <option value="5">
                5 秒
              </option>
              <option value="7">
                7 秒
              </option>
              <option value="10">
                10 秒
              </option>
            </select>
          </div>

          <!-- 随机化间隔时间 -->
          <div class="setting-item">
            <label>随机化间隔时间:</label>
            <button
              class="toggle-btn"
              :class="{ active: gazeAtUserConfig.randomizeInterval }"
              :disabled="!gazeAtUserConfig.enabled"
              @click="updateGazeAtUserConfig({ randomizeInterval: !gazeAtUserConfig.randomizeInterval })"
            >
              {{ gazeAtUserConfig.randomizeInterval ? '已开启' : '已关闭' }}
            </button>
            <p class="setting-description">
              在设定间隔的 50%-150% 之间随机变化，让行为更自然
            </p>
          </div>

          <!-- 随机化锁定时间 -->
          <div class="setting-item">
            <label>随机化锁定时间:</label>
            <button
              class="toggle-btn"
              :class="{ active: gazeAtUserConfig.randomizeDuration }"
              :disabled="!gazeAtUserConfig.enabled"
              @click="updateGazeAtUserConfig({ randomizeDuration: !gazeAtUserConfig.randomizeDuration })"
            >
              {{ gazeAtUserConfig.randomizeDuration ? '已开启' : '已关闭' }}
            </button>
            <p class="setting-description">
              在设定时长的 70%-130% 之间随机变化，避免过于规律
            </p>
          </div>

          <!-- 当前状态显示 -->
          <div class="setting-item">
            <label>当前状态:</label>
            <div class="status-display">
              <span v-if="!model" class="status-indicator">
                模型未加载
              </span>
              <span v-else-if="!(model as any).setEyesAlwaysLookAtCamera" class="status-indicator warning">
                模型不支持眼睛锁定
              </span>
              <span v-else-if="!gazeAtUserConfig.enabled" class="status-indicator">
                已停用
              </span>
              <span v-else-if="isGazingAtUser" class="status-indicator active">
                正在锁定用户
              </span>
              <span v-else class="status-indicator" :class="{ active: gazeAtUserConfig.enabled }">
                等待中
              </span>
            </div>
          </div>

          <!-- 测试按钮 -->
          <div class="setting-item">
            <label>测试功能:</label>
            <button
              class="action-btn"
              :disabled="!model || !(model as any).setEyesAlwaysLookAtCamera || !gazeAtUserConfig.enabled || isGazingAtUser"
              @click="startGazeAtUser"
            >
              {{ isGazingAtUser ? '正在锁定...' : '立即测试锁定' }}
            </button>
            <p v-if="model && !(model as any).setEyesAlwaysLookAtCamera" class="setting-description warning-text">
              当前Live2D模型不支持眼睛锁定功能
            </p>
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
    </div>
  </teleport>

  <!-- 人设编辑器弹窗 -->
  <teleport to="body">
    <div v-if="showCharacterEditor" class="editor-overlay" @click="handleCharacterEditorCancel">
      <div class="editor-container" @click.stop>
        <CharacterEditor
          :character="editingCharacter"
          :mode="characterEditorMode"
          @save="handleCharacterSave"
          @cancel="handleCharacterEditorCancel"
          @delete="handleCharacterEditorDelete"
        />
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
  align-items: flex-end;
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
  border-radius: 12px;
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
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.9);
  font-size: 16px;
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
  transform-origin: center bottom;
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

/* 吐槽气泡样式 */
.roast-bubble {
  position: absolute;
  z-index: 201;
  max-width: 350px;
  min-width: 150px;
  pointer-events: none;
  -webkit-app-region: no-drag;
  animation: roastBubbleIn 0.5s ease-out;
  transform-origin: center bottom;
}

.roast-bubble-content {
  background: rgba(240, 240, 240, 0.95);
  border: 1px solid #ccc;
  border-radius: 18px;
  padding: 12px 16px;
  font-size: 14px;
  line-height: 1.4;
  color: #555;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  word-wrap: break-word;
  white-space: pre-wrap;
  position: relative;
}

.roast-bubble-arrow {
  position: absolute;
  bottom: -8px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-top: 8px solid rgba(240, 240, 240, 0.95);
}

.roast-bubble-arrow::before {
  content: '';
  position: absolute;
  top: -9px;
  left: -8px;
  width: 0;
  height: 0;
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-top: 8px solid #ccc;
}

/* 吐槽气泡动画 */
@keyframes roastBubbleIn {
  0% {
    transform: translate(-50%, -100%) scale(0.8);
  }
  100% {
    transform: translate(-50%, -100%) scale(1);
  }
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
  padding: 0;
  min-width: 400px;
  max-width: 500px;
  min-height: 500px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  pointer-events: auto;
  max-height: 85vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* 标签页导航样式 */
.settings-tabs {
  display: flex;
  border-bottom: 1px solid #e0e0e0;
  background: #f8f9fa;
  border-radius: 12px 12px 0 0;
}

.tab-button {
  flex: 1;
  padding: 16px 20px;
  border: none;
  background: transparent;
  color: #666;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 12px 12px 0 0;
}

.tab-button:first-child {
  border-radius: 12px 0 0 0;
}

.tab-button:last-child {
  border-radius: 0 12px 0 0;
}

.tab-button:hover {
  background: rgba(74, 158, 255, 0.1);
  color: #333;
}

.tab-button.active {
  background: white;
  color: #4a9eff;
  font-weight: 600;
  border-bottom: 2px solid #4a9eff;
}

/* 标签页内容样式 */
.tab-content {
  padding: 24px;
  flex: 1;
  overflow-y: auto;
  min-height: 400px;
  /* 确保滚动条样式美观 */
  scrollbar-width: thin;
  scrollbar-color: #ccc transparent;
}

.tab-content::-webkit-scrollbar {
  width: 6px;
}

.tab-content::-webkit-scrollbar-track {
  background: transparent;
}

.tab-content::-webkit-scrollbar-thumb {
  background: #ccc;
  border-radius: 3px;
}

.tab-content::-webkit-scrollbar-thumb:hover {
  background: #999;
}

.tab-content h3 {
  margin: 0 0 20px 0;
  color: #333;
  font-size: 18px;
  text-align: center;
}

/* 人设编辑器弹窗样式 */
.editor-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  z-index: 11000;
  display: flex;
  justify-content: center;
  align-items: center;
  -webkit-app-region: no-drag;
  pointer-events: auto;
}

.editor-container {
  max-width: 90vw;
  max-height: 90vh;
  overflow: auto;
  pointer-events: auto;
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

/* 截图吐槽设置样式 */
.toggle-btn {
  padding: 8px 16px;
  border: 2px solid #ddd;
  border-radius: 20px;
  background: #f8f9fa;
  color: #666;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 14px;
  font-weight: 500;
}

.toggle-btn:hover {
  border-color: #007bff;
  background: #e7f3ff;
}

.toggle-btn.active {
  border-color: #28a745;
  background: linear-gradient(135deg, #28a745, #20c997);
  color: white;
  box-shadow: 0 2px 8px rgba(40, 167, 69, 0.3);
}

.setting-select {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: white;
  font-size: 14px;
  min-width: 150px;
}

.setting-select:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.action-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #ff6b6b, #feca57);
  color: white;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(255, 107, 107, 0.3);
}

.action-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(255, 107, 107, 0.4);
}

.action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.manual-trigger-group {
  display: flex;
  align-items: center;
  gap: 16px;
}

.hotkey-tip {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #666;
  font-size: 12px;
}

.hotkey-label {
  font-weight: 500;
}

.hotkey-kbd {
  display: inline-block;
  padding: 4px 8px;
  background: linear-gradient(135deg, #f8f9fa, #e9ecef);
  border: 1px solid #dee2e6;
  border-radius: 4px;
  font-family: 'Courier New', Courier, monospace;
  font-size: 11px;
  font-weight: bold;
  color: #495057;
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.6);
  min-width: 24px;
  text-align: center;
}

.current-roast {
  margin-top: 20px;
  padding: 16px;
  background: linear-gradient(135deg, rgba(255, 107, 107, 0.1), rgba(254, 202, 87, 0.1));
  border: 1px solid rgba(255, 107, 107, 0.3);
  border-radius: 12px;
}

.current-roast h4 {
  margin: 0 0 10px 0;
  color: #ff6b6b;
  font-size: 16px;
}

.roast-content {
  background: rgba(255, 255, 255, 0.9);
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 8px;
  color: #333;
  line-height: 1.4;
}

.roast-time {
  font-size: 12px;
  color: #666;
  text-align: right;
}

.roast-history {
  margin-top: 20px;
  max-height: 200px;
  overflow-y: auto;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.history-header h4 {
  margin: 0;
  color: #333;
  font-size: 16px;
}

.clear-btn {
  padding: 6px 12px;
  border: 1px solid #dc3545;
  border-radius: 6px;
  background: transparent;
  color: #dc3545;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s ease;
}

.clear-btn:hover {
  background: #dc3545;
  color: white;
}

.history-list {
  max-height: 150px;
  overflow-y: auto;
}

.history-item {
  padding: 8px 12px;
  margin-bottom: 8px;
  background: rgba(0, 0, 0, 0.03);
  border-radius: 8px;
  border-left: 3px solid #ff6b6b;
}

.history-content {
  font-size: 13px;
  color: #333;
  margin-bottom: 4px;
  line-height: 1.3;
}

.history-time {
  font-size: 11px;
  color: #999;
  text-align: right;
}

/* 响应式设计 */
@media (max-width: 600px) {
  .chat-bubble {
    max-width: 250px;
  }

  .roast-bubble {
    max-width: 280px;
  }

  .bubble-content {
    font-size: 13px;
    padding: 10px 14px;
  }

  .roast-bubble-content {
    font-size: 13px;
    padding: 12px 16px;
  }

  .settings-panel {
    margin: 20px;
    min-width: auto;
    width: calc(100% - 40px);
  }
}

/* 录制模式相关样式 */
.recording-mode-info {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: rgba(0, 123, 255, 0.05);
  border-radius: 12px;
  border: 1px solid rgba(0, 123, 255, 0.1);
}

.mode-description {
  margin: 0;
  font-size: 14px;
  color: #555;
  line-height: 1.4;
}

.recording-tips {
  padding: 16px;
  background: rgba(255, 235, 59, 0.05);
  border-radius: 8px;
  border-left: 4px solid #ffc107;
}

.recording-tips h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: #333;
  font-weight: 600;
}

.recording-tips ul {
  margin: 0;
  padding-left: 20px;
}

.recording-tips li {
  font-size: 13px;
  color: #666;
  line-height: 1.4;
  margin-bottom: 6px;
}

.recording-tips li:last-child {
  margin-bottom: 0;
}

/* 目光跟踪设置样式 */
.setting-description {
  margin: 4px 0 0 0;
  font-size: 12px;
  color: #666;
  line-height: 1.3;
}

.status-display {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.status-indicator {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  background: #f0f0f0;
  color: #666;
  transition: all 0.3s ease;
}

.status-indicator.active {
  background: linear-gradient(135deg, #28a745, #20c997);
  color: white;
  animation: pulse 2s infinite;
}

.status-indicator.warning {
  background: linear-gradient(135deg, #ffc107, #fd7e14);
  color: white;
}

.warning-text {
  color: #dc3545 !important;
  font-weight: 500;
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(40, 167, 69, 0.4);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(40, 167, 69, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(40, 167, 69, 0);
  }
}
</style>
