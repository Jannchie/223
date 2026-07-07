<!-- eslint-disable no-console -->
<script setup lang="ts">
import type { Live2DModel } from '@jannchie/pixi-live2d-display'
import type { Character } from '../types/chat'
import type { RoastStyle } from '../utils/screenshot-prompts'
import type { RoastResult, ScreenshotRoastConfig } from '../utils/screenshot-roast'
import { useLocalStorage } from '@vueuse/core'
import { Ticker } from 'pixi.js'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useChatCompatible } from '../composables/useChat'
import { useGaze } from '../composables/useGaze'
import { useLive2DCanvas } from '../composables/useLive2DCanvas'
import { characterService } from '../services/character-service'
import { chatService } from '../services/chat-service'
import { getRoastPrompt } from '../utils/screenshot-prompts'
import { RoastHistoryManager, ScreenshotRoastManager } from '../utils/screenshot-roast'
import CharacterEditor from './CharacterEditor.vue'
import SettingsPanel from './settings/SettingsPanel.vue'

// 语音识别类型定义
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition
    webkitSpeechRecognition: new () => SpeechRecognition
  }
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  maxAlternatives: number
  start: () => void
  stop: () => void
  abort: () => void
  onstart: ((event: Event) => void) | null
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: ((event: Event) => void) | null
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
}

interface SpeechRecognitionResultList {
  length: number
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  length: number
  [index: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

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

// 语音识别相关状态
const isListening = ref(false)
// const recognition = ref<SpeechRecognition | null>(null)
const voiceRecognitionAvailable = ref(false)
const mediaRecorder = ref<MediaRecorder | null>(null)
const audioChunks = ref<Blob[]>([])
const audioStream = ref<MediaStream | null>(null)
const lastF6PressTime = ref<number>(0)
const isRecording = ref(false)

// Pin 状态 - 当pinned为true时，除了pin按钮外的所有交互都被禁用
const isPinned = ref(false)
const isHoveringModel = ref(false)
const isInputVisible = ref(false)

// 聊天功能集成
const {
  isTyping: chatIsTyping,
  currentResponse: chatCurrentResponse,
  error: chatError,
  config: chatConfig,
  sendMessage: chatSendMessage,
  setCharacter: chatSetCharacter,
  updateConfig,
} = useChatCompatible()

// 兼容旧版本的状态映射
const apiKey = computed({
  get: () => chatConfig.value.apiKey,
  set: (value: string) => updateConfig({ apiKey: value }),
})
const controlsVisible = computed(() => isPinned.value || isInputVisible.value)
const baseURL = computed({
  get: () => chatConfig.value.baseURL || 'https://api.openai.com/v1',
  set: (value: string) => updateConfig({ baseURL: value }),
})
const showSettings = ref(false)
const urlParams = new URLSearchParams(globalThis.location.search)
const isSettingsWindow = ref(urlParams.get('settings') === 'true')

function setApiKey(v: string) {
  apiKey.value = v
}

function setBaseURL(v: string) {
  baseURL.value = v
}

async function closeSettingsWindow() {
  if ((globalThis as any).electronAPI?.closeSettingsWindow) {
    await (globalThis as any).electronAPI.closeSettingsWindow()
    return
  }
  if (globalThis.window !== undefined) {
    window.close()
  }
}

async function openSettingsWindow() {
  if (isSettingsWindow.value) {
    showSettings.value = true
    return
  }
  if ((globalThis as any).electronAPI?.openSettingsWindow) {
    const opened = await (globalThis as any).electronAPI.openSettingsWindow()
    if (!opened) {
      showSettings.value = true
    }
    return
  }
  showSettings.value = true
}

// 人设管理相关状态
const currentCharacter = ref<Character | null>(null)
const activeSettingsTab = ref<'openai' | 'character' | 'roast' | 'gaze'>('openai')
const showCharacterEditor = ref(false)
const editingCharacter = ref<Character | null>(null)

// 角色选择和模型路径已由服务持久化，移除本地重复记录
const characterEditorMode = ref<'create' | 'edit'>('create')
const characterListRefreshKey = ref(0)

// 跨窗口角色同步：记录当前已加载的模型路径，避免仅改人设时重复加载模型
let loadedModelPath: string | null = null
// 应用来自其他窗口的角色变更时置位，避免广播回环
const isApplyingRemoteCharacterChange = ref(false)

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

// 目光追踪与锁定（抽为 composable）需要在 watch 使用前初始化
const {
  // gazeTargetX,
  // gazeTargetY,
  gazeAtUserConfig,
  isGazingAtUser,
  setGazeTarget,
  clearGazeTarget,
  startGazeAtUser,
  // stopGazeAtUser,
  startGazeAtUserTimer,
  stopGazeAtUserTimer,
  updateGazeAtUserConfig,
  updateGazeParameters,
} = useGaze()

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

// Window and pointer state
const windowWidth = ref(window.innerWidth)
const windowHeight = ref(window.innerHeight)

const mouseX = ref(0)
const mouseY = ref(0)
const isLive2DModelLoaded = ref(false)
let model: Live2DModel | null = null
const {
  app,
  model: modelRef,
  initApp,
  loadModelFromURL,
  updateCanvasProperties: updateCanvasPropertiesFromComposable,
  canvasX,
  canvasY,
  canvasWidth,
  canvasHeight,
  canvasScale,
  // minScale,
  // maxScale,
  isDragging,
  startDrag,
  dragTo,
  endDrag,
  wheelZoomAt,
} = useLive2DCanvas()

const controlViewportPadding = 12
const pinnedControlSize = 32
const minInputContainerWidth = 180
const inputContainerEstimatedHeight = 88

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function clampToViewport(value: number, size: number, viewportSize: number): number {
  const min = controlViewportPadding
  const max = Math.max(min, viewportSize - size - controlViewportPadding)
  return clampNumber(value, min, max)
}

const inputContainerStyle = computed<Record<string, string>>(() => {
  const rawWidth = Math.max(canvasWidth.value * canvasScale.value, minInputContainerWidth)
  const maxWidth = Math.max(minInputContainerWidth, windowWidth.value - controlViewportPadding * 2)
  const width = isPinned.value ? pinnedControlSize : Math.min(rawWidth, maxWidth)
  const height = isPinned.value ? pinnedControlSize : inputContainerEstimatedHeight
  const rawLeft = isPinned.value
    ? canvasX.value + canvasWidth.value * canvasScale.value - pinnedControlSize
    : canvasX.value
  const rawTop = canvasY.value + inputPositionY.value

  return {
    'left': `${clampToViewport(rawLeft, width, windowWidth.value)}px`,
    'top': `${clampToViewport(rawTop, height, windowHeight.value)}px`,
    'width': `${width}px`,
    '--canvas-scale': String(canvasScale.value),
  }
})

// 记录上次目标值的逻辑已移入 useGaze

// 拖拽、缩放、画布位置/尺寸由 useLive2DCanvas 管理

// 存储模型的基础缩放比例（已由 useLive2DCanvas 管理）
// let baseModelScale = 1

// setGazeTarget / clearGazeTarget 由 useGaze 提供

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
    timeoutId = setTimeout(func, delay, ...args)
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
      const inputElement = document.querySelector('.text-input [data-slot="base"]') as HTMLInputElement
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

// 测试麦克风权限
async function testMicrophonePermission() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    console.log('麦克风权限测试成功')
    for (const track of stream.getTracks()) track.stop() // 停止流
    return true
  }
  catch (error) {
    console.error('麦克风权限测试失败:', error)
    return false
  }
}

// 初始化音频录制
function initializeAudioRecording() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    console.warn('当前浏览器不支持音频录制功能')
    voiceRecognitionAvailable.value = false
    return
  }

  voiceRecognitionAvailable.value = true
  console.log('音频录制功能已初始化')
}

// 开始音频录制
async function startAudioRecording() {
  try {
    // 获取麦克风流
    audioStream.value = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16_000, // 16kHz采样率，适合语音识别
        channelCount: 1, // 单声道
        echoCancellation: true,
        noiseSuppression: true,
      },
    })

    // 重置音频块
    audioChunks.value = []

    // 创建MediaRecorder
    mediaRecorder.value = new MediaRecorder(audioStream.value, {
      mimeType: 'audio/webm;codecs=opus', // 使用opus编码，压缩率好
    })

    mediaRecorder.value.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.value.push(event.data)
      }
    }

    mediaRecorder.value.onstop = async () => {
      // 录制结束后处理音频
      const audioBlob = new Blob(audioChunks.value, { type: 'audio/webm;codecs=opus' })
      const base64Audio = await blobToBase64(audioBlob)

      console.log('音频录制完成，长度:', audioBlob.size, 'bytes')

      // 发送音频给AI
      await sendAudioToAI(base64Audio)
    }

    // 开始录制
    mediaRecorder.value.start()
    isListening.value = true
    isRecording.value = true
  }
  catch (error) {
    console.error('开始音频录制失败:', error)
    isListening.value = false
    isRecording.value = false
  }
}

// 停止音频录制
function stopAudioRecording() {
  if (mediaRecorder.value && mediaRecorder.value.state !== 'inactive') {
    mediaRecorder.value.stop()
  }

  if (audioStream.value) {
    for (const track of audioStream.value.getTracks()) track.stop()
    audioStream.value = null
  }

  isListening.value = false
  isRecording.value = false
}

// 将Blob转换为base64
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      // 移除data:audio/webm;codecs=opus;base64,前缀，只保留base64数据
      const base64 = result.split(',')[1]
      resolve(base64)
    }
    reader.addEventListener('error', () => reject(new Error('FileReader error')))
    reader.readAsDataURL(blob)
  })
}

// 发送音频给AI进行处理
async function sendAudioToAI(base64Audio: string) {
  if (!apiKey.value) {
    showTemporaryBubble('请先配置 API Key')
    return
  }

  try {
    // 直接传递base64音频数据进行转录和聊天
    await sendAudioMessage(base64Audio)
  }
  catch (error) {
    console.error('发送音频给AI失败:', error)
  }
}

// 发送音频消息（先转录为文本，再发送给AI）
async function sendAudioMessage(base64Audio: string) {
  try {
    // 动态导入 OpenAI 客户端
    const { OpenAI } = await import('openai')

    // 创建 OpenAI 客户端用于音频转录
    const openai = new OpenAI({
      apiKey: apiKey.value,
      baseURL: baseURL.value.includes('openai.com') ? undefined : baseURL.value,
      dangerouslyAllowBrowser: true, // 允许在浏览器中使用
    })

    // 将 base64 转换为 File 对象
    const audioBlob = new Blob([Uint8Array.from(atob(base64Audio), c => c.codePointAt(0) ?? 0)], {
      type: 'audio/webm;codecs=opus',
    })
    const audioFile = new File([audioBlob], 'audio.webm', { type: 'audio/webm;codecs=opus' })

    // 使用 Whisper 转录音频
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'zh', // 指定中文
    })

    const transcribedText = transcription.text
    console.log('音频转录结果:', transcribedText)

    if (!transcribedText || transcribedText.trim() === '') {
      return
    }

    // 将转录的文本作为普通消息发送给 AI
    inputText.value = transcribedText

    // 重置typing状态，然后发送消息
    isTyping.value = false
    await sendMessage() // 使用现有的文本聊天功能
  }
  catch (error) {
    console.error('音频处理失败:', error)
  }
}

// 检查网络连接
async function checkNetworkConnection(): Promise<boolean> {
  try {
    // 尝试连接到一个总是可达的服务
    await fetch('https://www.google.com/generate_204', {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-cache',
    })
    return true
  }
  catch {
    return false
  }
}

// 切换式语音录制（F6键控制开始/停止）
async function startVoiceRecognition() {
  const currentTime = Date.now()

  // 检查点击间隔，小于1秒则忽略
  if (currentTime - lastF6PressTime.value < 1000) {
    return
  }

  lastF6PressTime.value = currentTime

  if (!voiceRecognitionAvailable.value) {
    return
  }

  if (isTyping.value) {
    return
  }

  if (!apiKey.value) {
    return
  }

  // 检查网络连接
  const hasNetwork = await checkNetworkConnection()
  if (!hasNetwork) {
    return
  }

  // 切换录音状态
  if (isRecording.value) {
    // 当前正在录音，停止录音
    stopAudioRecording()
  }
  else {
    // 当前没有录音，开始录音
    await startAudioRecording()
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
// 已移除未使用的辅助函数（用户位置与随机化间隔/时长）

// startGazeAtUser / stopGazeAtUser 由 useGaze 提供

// 定时器逻辑移入 useGaze

// 更新目光锁定配置由 useGaze 提供

// 将钩子函数暴露到全局
if (typeof globalThis !== 'undefined') {
  ;(globalThis as any).setGazeTarget = setGazeTarget
  ;(globalThis as any).clearGazeTarget = clearGazeTarget
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

// 监听目光设置变化，动态启停定时器（确保在 useGaze 初始化之后）
watch(() => gazeAtUserConfig.value.enabled, (enabled) => {
  if (enabled) {
    startGazeAtUserTimer(
      () => isInputFocused.value || showSettings.value || isTyping.value,
      () => model,
    )
  }
  else {
    stopGazeAtUserTimer()
  }
})

// 当间隔或时长参数变化时，若启用则重启计时器，以应用新配置
watch(gazeAtUserConfig, () => {
  if (gazeAtUserConfig.value.enabled) {
    startGazeAtUserTimer(
      () => isInputFocused.value || showSettings.value || isTyping.value,
      () => model,
    )
  }
}, { deep: true })

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

// 目光追踪更新逻辑已由 useGaze 提供

// 当缩放比例变化时，重新计算输入框位置
watch(canvasScale, () => {
  calculateInputPosition()
})

// 更新canvas属性和位置
function updateCanvasProperties() {
  updateCanvasPropertiesFromComposable()
  if (model) {
    calculateInputPosition()
  }
}

// 检查鼠标是否在输入框或canvas区域
// 检查鼠标是否在pin按钮区域内
function isPointInPinButton(clientX: number, clientY: number): boolean {
  const pinButton = document.querySelector('.pin-button') as HTMLElement
  if (!pinButton) {
    return false
  }

  const rect = pinButton.getBoundingClientRect()
  return clientX >= rect.left && clientX <= rect.right
    && clientY >= rect.top && clientY <= rect.bottom
}

function checkMouseInInteractiveArea(clientX: number, clientY: number): boolean {
  // 如果处于pin状态，只有pin按钮区域是交互区域
  if (isPinned.value) {
    return isPointInPinButton(clientX, clientY)
  }

  // 正常状态下的交互区域检查
  const inCanvas = isPointInCanvas(clientX, clientY)
  const inInput = isPointInInput(clientX, clientY)
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

function updateMouseEventTransparency(clientX: number, clientY: number) {
  const shouldCaptureMouse = isDragging.value || checkMouseInInteractiveArea(clientX, clientY)
  setMouseEventTransparency(!shouldCaptureMouse)
}

// 鼠标移动事件处理（主要用于拖拽）
function handleMouseMove(event: MouseEvent) {
  // 更新鼠标位置
  mouseX.value = event.clientX
  mouseY.value = event.clientY
  isHoveringModel.value = isPointInCanvas(event.clientX, event.clientY)

  // 检查是否应该显示输入框和控制鼠标穿透
  const shouldShowInput = checkMouseInInteractiveArea(event.clientX, event.clientY)
  isInputVisible.value = shouldShowInput

  // 根据是否在交互区域控制鼠标穿透
  updateMouseEventTransparency(event.clientX, event.clientY)

  // 拖拽移动（内部会判断是否在拖拽中）
  dragTo(event.clientX, event.clientY)
}

// 检查点击是否在canvas区域内
function isPointInCanvas(clientX: number, clientY: number): boolean {
  if (!isLive2DModelLoaded.value || !model) {
    return false
  }

  try {
    const bounds = model.getBounds()
    if (bounds.width <= 0 || bounds.height <= 0) {
      return false
    }

    const padding = 12
    const left = canvasX.value + bounds.x - padding
    const right = canvasX.value + bounds.x + bounds.width + padding
    const top = canvasY.value + bounds.y - padding
    const bottom = canvasY.value + bounds.y + bounds.height + padding

    return clientX >= left && clientX <= right && clientY >= top && clientY <= bottom
  }
  catch {
    return false
  }
}

// 鼠标按下事件处理
function handleMouseDown(event: MouseEvent) {
  // 如果被pin住，不处理拖拽交互
  if (isPinned.value) {
    return
  }

  // 如果点击在输入框区域内，不处理拖拽
  if (isPointInInput(event.clientX, event.clientY)) {
    return
  }

  // 只有点击在canvas区域内才处理拖拽
  if (isPointInCanvas(event.clientX, event.clientY)) {
    startDrag(event.clientX, event.clientY)
    setMouseEventTransparency(false)
    event.preventDefault()
    event.stopPropagation()
  }
}

// 鼠标释放事件处理
function handleMouseUp(event: MouseEvent) {
  mouseX.value = event.clientX
  mouseY.value = event.clientY
  endDrag()
  updateMouseEventTransparency(event.clientX, event.clientY)
}

// 鼠标离开处理
function handleMouseLeave() {
  isInputVisible.value = false
  isHoveringModel.value = false
  // 鼠标完全离开应用区域时，恢复完全穿透
  if (!isDragging.value) {
    setMouseEventTransparency(true)
  }
}

// 滚轮事件处理（以鼠标位置为中心缩放canvas）
function handleWheel(event: WheelEvent) {
  // 如果被pin住，不处理缩放交互
  if (isPinned.value) {
    return
  }

  // 只有滚轮在canvas区域内才响应缩放
  if (isPointInCanvas(event.clientX, event.clientY)) {
    event.preventDefault()
    event.stopPropagation()

    wheelZoomAt(event.clientX, event.clientY, event.deltaY)
    // 缩放后重新计算输入框相对位置
    calculateInputPosition()
  }
  // 在透明区域滚轮不阻止默认行为，让桌面程序正常响应滚轮
}

// 检查点击是否在输入框区域内
function isPointInInput(clientX: number, clientY: number): boolean {
  if (!controlsVisible.value && !isInputFocused.value) {
    return false
  }

  const inputContainer = document.querySelector('.input-container') as HTMLElement
  if (!inputContainer) {
    return false
  }

  const rect = inputContainer.getBoundingClientRect()
  return (clientX >= rect.left && clientX <= rect.right
          && clientY >= rect.top && clientY <= rect.bottom)
}

// 检查点击是否在设置面板区域内
function isPointInSettings(_clientX: number, _clientY: number): boolean {
  return showSettings.value
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
  // 如果被pin住，不处理右键菜单交互
  if (isPinned.value) {
    return
  }

  // 如果右键不在canvas区域内，不阻止事件，让桌面右键菜单正常显示
  if (!isPointInCanvas(event.clientX, event.clientY)) {
    return
  }
  // 在canvas区域内的右键，显示设置面板
  event.preventDefault()
  void openSettingsWindow()
}

// 保存设置
function saveSettings() {
  if (isSettingsWindow.value) {
    closeSettingsWindow()
    return
  }
  initializeChatService()
  showSettings.value = false
  showTemporaryBubble('设置已保存')
}

// 取消设置
function cancelSettings() {
  if (isSettingsWindow.value) {
    closeSettingsWindow()
    return
  }
  showSettings.value = false
}

// 切换Pin状态
function togglePin() {
  isPinned.value = !isPinned.value
  if (!isPinned.value) {
    isHoveringModel.value = false
    return
  }
  isInputVisible.value = false
  isInputFocused.value = false
  const inputElement = document.querySelector('.text-input [data-slot="base"]') as HTMLInputElement | null
  inputElement?.blur()
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
    const targetCharacter = await characterService.getCurrentCharacterAsync()
    currentCharacter.value = targetCharacter
    if (targetCharacter) {
      // 同步聊天模块的当前角色，确保系统提示词一致
      await chatSetCharacter(targetCharacter.id)
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
    characterListRefreshKey.value++

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
  characterListRefreshKey.value++

  // 如果保存的是当前角色或者是新创建的角色，切换到该角色
  if (!currentCharacter.value || character.id === currentCharacter.value.id || characterEditorMode.value === 'create') {
    await switchCharacter(character)
  }
  else {
    // 如果编辑的不是当前角色，但用户可能想切换到编辑的角色
    // 更新保存记录（如果用户之后手动选择这个角色，会记住新的设置）
    // 由服务层持久化，无需本地记录
  }

  showTemporaryBubble(`角色 "${character.name}" 已保存`)
}

function handleCharacterEditorCancel() {
  showCharacterEditor.value = false
  editingCharacter.value = null
}

function handleCharacterEditorOpenChange(open: boolean) {
  if (!open) {
    handleCharacterEditorCancel()
  }
}

async function handleCharacterEditorDelete(character: Character) {
  showCharacterEditor.value = false
  editingCharacter.value = null
  await handleCharacterDelete(character)
}

// 通过主进程广播角色变更到其他窗口（比 localStorage storage 事件更可靠）
function broadcastCharacterChange(id: string) {
  if (isApplyingRemoteCharacterChange.value) {
    return
  }
  const api = (globalThis as any).electronAPI
  if (api?.notifyCharacterChanged) {
    api.notifyCharacterChanged({ id: String(id) })
  }
}

// 应用来自其他窗口的角色变更
async function applyRemoteCharacterChange(id: string) {
  if (!id) {
    return
  }
  isApplyingRemoteCharacterChange.value = true
  try {
    const next = await characterService.getCharacter(String(id))
    if (next) {
      await switchCharacter(next)
    }
  }
  catch (error) {
    console.error('应用远程角色变更失败:', error)
  }
  finally {
    isApplyingRemoteCharacterChange.value = false
  }
}

// 切换角色
async function switchCharacter(character: Character) {
  try {
    if (isSettingsWindow.value) {
      await characterService.setCurrentCharacter(character.id)
      currentCharacter.value = character
      // 通知主窗口即时应用最新人设/模型
      broadcastCharacterChange(character.id)
      return
    }
    // 更新聊天组合式中的当前角色，确保对话使用最新人设
    await chatSetCharacter(character.id)
    // 同步服务层当前角色（兼容其他使用该服务的模块）
    await characterService.setCurrentCharacter(character.id)
    currentCharacter.value = character

    console.log('保存角色选择:', character.name, 'ID:', character.id.toString())

    // 仅在模型路径变化时重新加载 Live2D 模型，避免仅改人设时的无谓闪烁
    if (character.modelPath && character.modelPath !== loadedModelPath) {
      await loadLive2DModel(character.modelPath)
    }

    // 重新初始化聊天服务以使用新的角色设定
    initializeChatService()

    // 通知其他窗口（如设置窗口）保持角色选择同步
    broadcastCharacterChange(character.id)

    showTemporaryBubble(`已切换到角色 "${character.name}"`)
  }
  catch (error) {
    console.error('切换角色失败:', error)
    showTemporaryBubble(`切换角色失败: ${error instanceof Error ? error.message : String(error)}`)
  }
}

// 加载 Live2D 模型
async function loadLive2DModel(modelPath: string) {
  isLive2DModelLoaded.value = false
  try {
    const modelURL = getModelURL(modelPath)
    console.log('Loading model from:', modelURL)
    await loadModelFromURL(modelURL)
    model = modelRef.value as unknown as Live2DModel | null
    isLive2DModelLoaded.value = !!model
    loadedModelPath = modelPath
    // 重新计算输入框位置
    calculateInputPosition()
  }
  catch (error) {
    model = null
    isLive2DModelLoaded.value = false
    console.error('模型加载失败:', error)
    showTemporaryBubble(`模型加载失败: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function switchSettingsTab(tab: 'openai' | 'character' | 'roast' | 'gaze') {
  activeSettingsTab.value = tab
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

function handleGazeTestLock() {
  startGazeAtUser(modelRef.value)
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
  updateMouseEventTransparency(event.clientX, event.clientY)
}

// 监听窗口大小变化
function handleResize() {
  windowWidth.value = window.innerWidth
  windowHeight.value = window.innerHeight
}

const CHARACTER_ID_KEY = 'current-character-id'
const CHARACTER_SYNC_KEYS = new Set([CHARACTER_ID_KEY, 'current-character-updated-at'])

function getStoredCharacterId(): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(CHARACTER_ID_KEY)
    }
  }
  catch {
    // ignore
  }
  return null
}

function handleStorageChange(event: StorageEvent) {
  if (!event.key || !CHARACTER_SYNC_KEYS.has(event.key)) {
    return
  }
  const targetId = event.key === CHARACTER_ID_KEY ? event.newValue : getStoredCharacterId()
  if (!targetId) {
    return
  }
  void (async () => {
    const next = await characterService.getCharacter(targetId)
    if (!next) {
      return
    }
    await switchCharacter(next)
  })()
}

onMounted(async () => {
  setMouseEventTransparency(true)

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

  if (isSettingsWindow.value) {
    showSettings.value = true
    return
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

  // 跨窗口角色同步：优先使用主进程 IPC 广播（可靠），否则回退到 storage 事件
  if ((globalThis as any).electronAPI?.onCharacterChanged) {
    (globalThis as any).electronAPI.onCharacterChanged((payload: { id: string }) => {
      void applyRemoteCharacterChange(payload.id)
    })
  }
  else {
    globalThis.addEventListener('storage', handleStorageChange)
  }

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

  await initApp(canvas, { width: initialWidth, height: initialHeight, backgroundAlpha: 0 })
  // 限制帧率为 60fps 以平衡性能和流畅度
  Ticker.shared.maxFPS = 60
  // 移除不必要的 minFPS 设置

  // 使用当前角色的模型路径，如果没有则使用默认路径
  const modelPath = currentCharacter.value?.modelPath || '06-v2.1024/06-v2.model3.json'
  const modelURL = getModelURL(modelPath)
  console.log('Loading model from:', modelURL)

  // 带重试的模型加载，以防服务器还未准备好
  isLive2DModelLoaded.value = false
  let retries = 3
  let modelLoadError: unknown = null
  while (retries > 0) {
    try {
      await loadModelFromURL(modelURL)
      model = modelRef.value as unknown as Live2DModel | null
      isLive2DModelLoaded.value = !!model
      loadedModelPath = modelPath
      break
    }
    catch (error) {
      console.error(`Model loading failed, retries left: ${retries - 1}`, error)
      retries--
      if (retries === 0) {
        model = null
        isLive2DModelLoaded.value = false
        modelLoadError = error
        break
      }
      // 等待 1 秒后重试
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  // 将模型设为全局变量，方便外部访问
  if (modelLoadError) {
    const message = modelLoadError instanceof Error ? modelLoadError.message : String(modelLoadError)
    showTemporaryBubble(`Model failed to load: ${message}`)
  }

  if (typeof globalThis !== 'undefined') {
    (globalThis as any).live2dModel = model
  }
  // 由 useLive2DCanvas 内部完成模型定位与缩放

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
    const gazeTicker = () => {
      updateGazeParameters({
        model,
        canvasX: canvasX.value,
        canvasY: canvasY.value,
        canvasScale: canvasScale.value,
        canvasWidth: canvasWidth.value,
        canvasHeight: canvasHeight.value,
        mouseX: mouseX.value,
        mouseY: mouseY.value,
        isInputFocused: isInputFocused.value,
        isGazingAtUser: isGazingAtUser.value,
      })
    }
    const bubbleTicker = () => updateBubblePosition()
    app.ticker.add(gazeTicker as any)
    app.ticker.add(bubbleTicker as any)
    // 在卸载时移除这些回调
    onUnmounted(() => {
      app.ticker.remove(gazeTicker as any)
      app.ticker.remove(bubbleTicker as any)
    })
  }

  // 计算并设置输入框位置
  calculateInputPosition()

  // 监听electron后端的全局鼠标位置
  if ((globalThis as any).electronAPI && (globalThis as any).electronAPI.onMousePosition) {
    (globalThis as any).electronAPI.onMousePosition((position: { x: number, y: number }) => {
      mouseX.value = position.x
      mouseY.value = position.y
      isHoveringModel.value = isPointInCanvas(position.x, position.y)
      isInputVisible.value = checkMouseInInteractiveArea(position.x, position.y)
      updateMouseEventTransparency(position.x, position.y)
      // 如果输入框聚焦中或正在锁定用户，忽略鼠标位置事件
      if (!isInputFocused.value && !isGazingAtUser.value) {
        setGazeTarget(position.x, position.y)
      }
      if (isPinned.value) {
        isHoveringModel.value = isPointInCanvas(position.x, position.y)
      }
    })
  }

  // 测试麦克风权限
  testMicrophonePermission().then((hasPermission) => {
    if (hasPermission) {
      console.log('麦克风权限已获得，初始化音频录制')
      // 初始化音频录制
      initializeAudioRecording()
    }
    else {
      console.warn('麦克风权限未获得，音频录制功能不可用')
      voiceRecognitionAvailable.value = false
    }
  })

  // 监听F1快捷键事件
  if ((globalThis as any).electronAPI?.onHotkeyVoiceRecognition) {
    (globalThis as any).electronAPI.onHotkeyVoiceRecognition(() => {
      startVoiceRecognition()
    })
  }

  // 启动定期目光锁定计时器（根据忙碌状态与当前模型）
  startGazeAtUserTimer(
    () => isInputFocused.value || showSettings.value || isTyping.value,
    () => model,
  )
})

// 组件卸载时清理事件监听器
onUnmounted(() => {
  if ((globalThis as any).electronAPI && (globalThis as any).electronAPI.removeMousePositionListener) {
    (globalThis as any).electronAPI.removeMousePositionListener()
  }

  // 清理角色变更监听
  if ((globalThis as any).electronAPI?.removeCharacterChangedListener) {
    (globalThis as any).electronAPI.removeCharacterChangedListener()
  }

  // 清理截图监听器
  if ((globalThis as any).electronAPI && (globalThis as any).electronAPI.removeScreenshotListeners) {
    (globalThis as any).electronAPI.removeScreenshotListeners()
  }

  // 清理语音识别监听器
  if ((globalThis as any).electronAPI && (globalThis as any).electronAPI.removeVoiceRecognitionListener) {
    (globalThis as any).electronAPI.removeVoiceRecognitionListener()
  }

  // 停止音频录制
  if (isListening.value) {
    stopAudioRecording()
  }

  // 清理截图吐槽管理器
  if (screenshotRoastManager.value) {
    screenshotRoastManager.value.destroy()
    screenshotRoastManager.value = null
  }

  // 清理全局鼠标事件监听器
  document.removeEventListener('mousemove', handleMouseMove)
  // 清理ticker
  // 回调已通过 app.ticker.remove 在注册处移除
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
  globalThis.removeEventListener('storage', handleStorageChange)

  // 清理定期目光锁定计时器
  stopGazeAtUserTimer()
})
</script>

<template>
  <div
    v-if="!isSettingsWindow"
    class="live2d-container"
    :class="{ 'pinned-hover': isPinned && isHoveringModel }"
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
      :class="{ 'input-visible': controlsVisible }"
      :style="inputContainerStyle"
    >
      <UInput
        v-model="inputText"
        type="text"
        :placeholder="isTyping ? '正在思考...' : '请输入内容（回车发送）...'"
        class="text-input"
        :class="{ 'input-hidden': isPinned }"
        :disabled="isTyping"
        @focus="handleInputFocus"
        @blur="handleInputBlur"
        @input="handleInputChange"
        @keyup="handleInputCursorMove"
        @click="handleInputCursorMove"
        @keydown="handleKeyDown"
        @select="handleInputCursorMove"
      />
      <!-- 按钮容器 -->
      <div class="button-container" :class="{ pinned: isPinned }">
        <!-- Pin 按钮 -->
        <UButton
          class="pin-button"
          :class="{ pinned: isPinned }"
          :title="isPinned ? '取消固定' : '固定位置'"
          variant="ghost"
          color="neutral"
          size="xs"
          square
          :icon="isPinned ? 'i-carbon-pin-filled' : 'i-carbon-pin'"
          @click="togglePin"
        />

        <!-- 设置按钮 -->
        <UButton
          v-if="!isPinned"
          class="settings-button"
          title="打开设置"
          variant="ghost"
          color="neutral"
          size="xs"
          square
          icon="i-carbon-settings"
          @click="openSettingsWindow"
        />
      </div>
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

    <!-- 语音识别状态指示器 -->
    <div
      v-if="isListening"
      class="voice-listening-indicator"
      :style="{
        left: `${bubblePositionX}px`,
        top: `${bubblePositionY - 60}px`,
        transform: `translate(-50%, -100%) scale(${canvasScale})`,
      }"
    >
      <div class="listening-animation">
        <div class="wave" />
        <div class="wave" />
        <div class="wave" />
      </div>
      <div class="listening-text">
        正在听...
      </div>
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

  <!-- 新的设置面板组件 -->
  <SettingsPanel
    :visible="showSettings"
    :embedded="isSettingsWindow"
    :active-tab="activeSettingsTab"
    :api-key="apiKey"
    :base-u-r-l="baseURL"
    :current-character-id="currentCharacter?.id?.toString() || null"
    :character-refresh-key="characterListRefreshKey"
    :roast-config="roastConfig"
    :is-roasting="isRoasting"
    :current-roast="currentRoast"
    :roast-history="roastHistory"
    :gaze-at-user-config="gazeAtUserConfig"
    @update:active-tab="switchSettingsTab"
    @update:api-key="setApiKey"
    @update:base-u-r-l="setBaseURL"
    @character-select="handleCharacterSelect"
    @character-edit="handleCharacterEdit"
    @character-delete="handleCharacterDelete"
    @character-create="handleCharacterCreate"
    @roast-toggle-auto="toggleAutoRoast"
    @roast-set-interval="setRoastInterval"
    @roast-set-style="setRoastStyle"
    @roast-trigger="triggerManualRoast"
    @roast-clear-history="clearRoastHistory"
    @gaze-update-config="updateGazeAtUserConfig"
    @gaze-test-lock="handleGazeTestLock"
    @save="saveSettings"
    @cancel="cancelSettings"
  />

  <!-- 人设编辑器弹窗 -->
  <UModal
    :open="showCharacterEditor"
    :close="false"
    @update:open="handleCharacterEditorOpenChange"
  >
    <template #content>
      <CharacterEditor
        :character="editingCharacter"
        :mode="characterEditorMode"
        @save="handleCharacterSave"
        @cancel="handleCharacterEditorCancel"
        @delete="handleCharacterEditorDelete"
      />
    </template>
  </UModal>
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
  background-color: transparent;
  background-color: color-mix(in oklab, var(--ui-bg) 0.1%, transparent);
}

#canvas {
  display: block;
  -webkit-app-region: no-drag;
  pointer-events: auto;
  /* 位置和尺寸通过JavaScript动态设置 */
  transition: opacity 0.2s ease;
}

.live2d-container.pinned-hover #canvas {
  opacity: 0.15;
}

.input-container {
  position: absolute;
  z-index: 100;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  -webkit-app-region: no-drag;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}

.input-container.input-visible {
  opacity: 1;
  pointer-events: auto;
}

.input-container:focus-within {
  opacity: 1 !important;
  pointer-events: auto;
}

.input-container:hover {
  opacity: 1 !important;
  pointer-events: auto;
}

.text-input {
  width: 100%;
}

.text-input.input-hidden {
  display: none;
  opacity: 0;
  pointer-events: none;
}

:deep(.text-input [data-slot="base"]) {
  padding: 12px 18px;
  width: 100%;
  border: 1px solid var(--ui-border);
  border-radius: 16px;
  font-size: 14px;
  line-height: 1.5;
  background: var(--ui-bg-elevated);
  color: var(--ui-text);
  caret-color: var(--ui-primary);
  outline: none;
  -webkit-app-region: no-drag;
  pointer-events: auto;
  box-sizing: border-box;
  transition: border-color 0.2s ease, background 0.2s ease;
}

:deep(.text-input [data-slot="base"]::placeholder) {
  color: var(--ui-text-dimmed);
}

:deep(.text-input [data-slot="base"]:focus) {
  border-color: var(--ui-primary);
  background: var(--ui-bg-elevated);
}

:deep(.text-input [data-slot="base"]:disabled) {
  background: var(--ui-bg-muted);
  cursor: not-allowed;
}

/* 按钮容器样式 */
.button-container {
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 4px;
  border-radius: 14px;
  background: var(--ui-bg-elevated);
  border: 1px solid var(--ui-border);
  transition: background 0.2s ease, border-color 0.2s ease, padding 0.2s ease;
}

/* Pin 状态下只剩单个按钮，去除容器多余的背景 */
.button-container.pinned {
  padding: 0;
  background: transparent;
  border-color: transparent;
}

/* Pin 按钮样式 */
.pin-button,
.settings-button {
  width: 30px;
  height: 30px;
  padding: 0;
  min-width: 0;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--ui-text-muted);
  font-size: 15px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.18s ease, color 0.18s ease;
  -webkit-app-region: no-drag;
  pointer-events: auto;
}

.pin-button:hover,
.settings-button:hover {
  background: color-mix(in oklab, var(--ui-primary) 12%, var(--ui-bg-elevated));
  color: var(--ui-primary);
}

.pin-button.pinned {
  background: var(--ui-error);
  color: var(--ui-text-inverted);
}

.pin-button.pinned:hover {
  background: var(--ui-error);
  color: var(--ui-text-inverted);
}

/* 对话气泡样式 */
.chat-bubble {
  position: absolute;
  z-index: 200;
  max-width: 300px;
  min-width: 150px;
  margin-top: -10px;
  pointer-events: none;
  -webkit-app-region: no-drag;
  transform-origin: center bottom;
}

.bubble-content {
  animation: bubbleIn 0.32s cubic-bezier(0.16, 1, 0.3, 1);
  background: var(--ui-bg-elevated);
  border: 1px solid var(--ui-border);
  border-radius: 20px;
  padding: 12px 18px;
  font-size: 14px;
  line-height: 1.55;
  color: var(--ui-text-highlighted);
  word-wrap: break-word;
  white-space: pre-wrap;
  position: relative;
}

.bubble-arrow {
  position: absolute;
  bottom: -7px;
  left: 50%;
  transform: translateX(-50%) rotate(45deg);
  width: 14px;
  height: 14px;
  background: var(--ui-bg-elevated);
  border-right: 1px solid var(--ui-border);
  border-bottom: 1px solid var(--ui-border);
  border-bottom-right-radius: 4px;
}

@keyframes bubbleIn {
  from {
    opacity: 0;
    transform: scale(0.96);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* 吐槽气泡样式 */
.roast-bubble {
  position: absolute;
  z-index: 201;
  max-width: 350px;
  min-width: 150px;
  margin-top: -10px;
  pointer-events: none;
  -webkit-app-region: no-drag;
  transform-origin: center bottom;
}

.roast-bubble-content {
  animation: bubbleIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  background: color-mix(in oklab, var(--ui-color-warning-500) 16%, var(--ui-bg-elevated));
  border: 1px solid color-mix(in oklab, var(--ui-color-warning-500) 40%, var(--ui-border));
  border-radius: 20px;
  padding: 12px 18px;
  font-size: 14px;
  line-height: 1.55;
  color: var(--ui-text-highlighted);
  word-wrap: break-word;
  white-space: pre-wrap;
  position: relative;
}

.roast-bubble-arrow {
  position: absolute;
  bottom: -7px;
  left: 50%;
  transform: translateX(-50%) rotate(45deg);
  width: 14px;
  height: 14px;
  background: color-mix(in oklab, var(--ui-color-warning-500) 16%, var(--ui-bg-elevated));
  border-right: 1px solid color-mix(in oklab, var(--ui-color-warning-500) 40%, var(--ui-border));
  border-bottom: 1px solid color-mix(in oklab, var(--ui-color-warning-500) 40%, var(--ui-border));
  border-bottom-right-radius: 4px;
}

/* 语音识别状态指示器样式 */
.voice-listening-indicator {
  position: absolute;
  z-index: 250;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--ui-bg-inverted);
  color: var(--ui-text-inverted);
  border-radius: 999px;
  font-size: 13px;
  font-weight: 500;
  pointer-events: none;
  -webkit-app-region: no-drag;
  animation: fadeInOut 0.3s ease-in-out;
}

.listening-animation {
  display: flex;
  align-items: center;
  gap: 2px;
}

.wave {
  width: 3px;
  height: 12px;
  background: var(--ui-text-inverted);
  border-radius: 2px;
  animation: waveAnimation 1.4s ease-in-out infinite;
}

.wave:nth-child(2) {
  animation-delay: 0.2s;
}

.wave:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes waveAnimation {
  0%, 40%, 100% {
    transform: scaleY(0.4);
  }
  20% {
    transform: scaleY(1);
  }
}

@keyframes fadeInOut {
  from {
    opacity: 0;
    transform: translate(-50%, -100%) scale(0.9);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -100%) scale(1);
  }
}

/* 设置面板相关样式已迁移到 SettingsPanel 与各 Tab 组件 */

/* 人设编辑器弹窗样式 */

/* 设置项/按钮样式已由 SettingsPanel 子组件提供 */

/* 设置面板内样式（吐槽/录制等）已拆分到独立 Tab 组件 */

.history-content {
  font-size: 13px;
  color: var(--ui-text);
  margin-bottom: 4px;
  line-height: 1.3;
}

.history-time {
  font-size: 11px;
  color: var(--ui-text-muted);
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

  /* 设置面板响应式样式由 SettingsPanel 组件提供 */
}

/* 目光跟踪设置样式已迁移至 GazeSettings 组件 */
</style>
