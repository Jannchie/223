/**
 * Vue 聊天组合式函数
 * 提供响应式的聊天状态管理和方法
 */

import type {
  AIProvider,
  Character,
  ChatConfig,
  ChatContext,
  ExtendedMessage,
  StreamingCallbacks,
  UseChatReturn,
} from '../types/chat'
import { useLocalStorage } from '@vueuse/core'
import { onMounted, ref, watch } from 'vue'
import { characterService } from '../services/character-service'
import { chatService } from '../services/chat-service'
import { memoryService } from '../services/memory-service'
import { messageService } from '../services/message-service'

/**
 * 主要的聊天组合式函数
 */
export function useChat(): UseChatReturn {
  // 响应式状态
  const messages = ref<ExtendedMessage[]>([])
  const isTyping = ref(false)
  const currentResponse = ref('')
  const error = ref<string | null>(null)

  // 配置状态
  const config = ref<ChatConfig>({
    provider: 'openai' as AIProvider,
    model: 'gpt-4.1-nano',
    apiKey: '',
    baseURL: 'https://api.openai.com/v1',
    temperature: 0.7,
    maxTokens: 2000,
  })

  const character = ref<Character | null>(null)

  // 使用 localStorage 持久化配置
  const storedApiKey = useLocalStorage('openai-api-key', '')
  const storedBaseURL = useLocalStorage('openai-base-url', 'https://api.openai.com/v1')

  // 监听存储变化并更新配置
  watch([storedApiKey, storedBaseURL], ([apiKey, baseURL]) => {
    config.value.apiKey = apiKey
    config.value.baseURL = baseURL
  }, { immediate: true })

  /**
   * 加载当前人设
   */
  const loadCurrentCharacter = async () => {
    const current = await characterService.getCurrentCharacterAsync()
    if (current) {
      character.value = current
    }
  }

  /**
   * 加载当前会话的消息
   */
  const loadMessages = async () => {
    const currentSession = await messageService.getCurrentSession()
    if (currentSession) {
      const sessionMessages = await messageService.getMessages(currentSession.id)
      messages.value = sessionMessages
      console.log(`已加载会话 ${currentSession.id} 的 ${sessionMessages.length} 条消息`)
    }
    else {
      messages.value = []
    }
  }

  // 初始化
  onMounted(async () => {
    await loadCurrentCharacter()
    await loadMessages()
  })

  /**
   * 发送消息
   */
  const sendMessage = async (content: string): Promise<void> => {
    if (!content.trim() || isTyping.value) {
      return
    }

    // 验证配置
    if (!config.value.apiKey) {
      error.value = '请先配置 API Key'
      return
    }

    if (!character.value) {
      error.value = '请先选择人设'
      return
    }

    // 清除错误状态
    error.value = null

    try {
      // 添加用户消息
      const currentSession = await messageService.getCurrentSession()
      if (!currentSession) {
        error.value = '没有活跃的聊天会话'
        return
      }

      console.log(`开始在会话 ${currentSession.id} 中发送消息`)

      const userMessage = await messageService.addMessage(currentSession.id, {
        role: 'user',
        content: content.trim(),
        metadata: {
          provider: config.value.provider,
          model: config.value.model,
        },
      })

      // 更新本地消息列表
      messages.value.push(userMessage)

      // 开始响应生成
      isTyping.value = true
      currentResponse.value = ''

      // 获取相关记忆
      const relevantMemories = await chatService.getRelevantMemories(content)

      // 获取当前会话的历史消息
      const sessionMessages = await messageService.getMessages(currentSession.id)

      // 构建带有历史消息的会话对象
      const sessionWithMessages = {
        ...currentSession,
        messages: sessionMessages,
      }

      // 构建聊天上下文
      const chatContext: ChatContext = {
        character: character.value,
        recentMemories: relevantMemories,
        currentSession: sessionWithMessages,
        config: config.value,
      }

      // 准备流式回调
      const callbacks: StreamingCallbacks = {
        onToken: (token: string) => {
          currentResponse.value += token
        },
        onComplete: async (fullContent: string) => {
          try {
            // 添加助手消息
            const assistantMessage = await messageService.addMessage(currentSession.id, {
              role: 'assistant',
              content: fullContent,
              metadata: {
                provider: config.value.provider,
                model: config.value.model,
                tokenCount: chatService.estimateTokens(fullContent),
              },
            })

            // 更新本地消息列表
            messages.value.push(assistantMessage)

            // 重置状态
            isTyping.value = false
            currentResponse.value = ''

            // 从用户消息中提取记忆
            try {
              const userMemories = await memoryService.extractMemoriesFromMessage(userMessage)
              for (const memoryData of userMemories) {
                await memoryService.addMemory(memoryData)
              }
            }
            catch (memoryError) {
              console.warn('提取记忆失败，但不影响消息保存:', memoryError)
            }

            console.log(`消息对话完成，会话 ${currentSession.id} 现有 ${messages.value.length} 条消息`)
          }
          catch (error_) {
            console.error('处理完成回调失败:', error_)
            error.value = '处理响应失败'
            isTyping.value = false
          }
        },
        onError: (errorMsg: string) => {
          error.value = errorMsg
          isTyping.value = false
          currentResponse.value = ''
        },
        onMetadata: (metadata: Record<string, any>) => {
          // 可以用于显示token使用情况等元数据
          console.log('聊天元数据:', metadata)
        },
      }

      // 发送消息
      await chatService.sendMessage(content, chatContext, callbacks)
    }
    catch (error_) {
      console.error('发送消息失败:', error_)
      error.value = error_ instanceof Error ? error_.message : '发送消息失败'
      isTyping.value = false
    }
  }

  /**
   * 清空消息
   */
  const clearMessages = async () => {
    const currentSession = await messageService.getCurrentSession()
    if (currentSession) {
      await messageService.clearMessages(currentSession.id)
      messages.value = []
    }
  }

  /**
   * 设置当前人设
   */
  const setCharacter = async (characterId: string) => {
    try {
      await characterService.setCurrentCharacter(characterId)
      await loadCurrentCharacter()

      // 如果需要，可以创建新会话
      const currentSession = await messageService.getCurrentSession()
      if (currentSession && currentSession.characterId !== characterId) {
        await messageService.updateSession(currentSession.id, { characterId })
      }
    }
    catch (error_) {
      console.error('设置人设失败:', error_)
      error.value = error_ instanceof Error ? error_.message : '设置人设失败'
    }
  }

  /**
   * 更新配置
   */
  const updateConfig = (newConfig: Partial<ChatConfig>) => {
    config.value = { ...config.value, ...newConfig }

    // 同步到 localStorage
    if (newConfig.apiKey !== undefined) {
      storedApiKey.value = newConfig.apiKey
    }
    if (newConfig.baseURL !== undefined) {
      storedBaseURL.value = newConfig.baseURL
    }

    // 验证新配置
    error.value = chatService.validateConfig(config.value) ? null : '配置无效'
  }

  return {
    // 状态
    messages,
    isTyping,
    currentResponse,
    error,

    // 配置
    config,
    character,

    // 方法
    sendMessage,
    clearMessages,
    setCharacter,
    updateConfig,
  }
}

/**
 * 简化的聊天钩子，兼容旧版本
 */
export function useChatCompatible() {
  const {
    messages,
    isTyping,
    currentResponse,
    error,
    config,
    character,
    sendMessage,
    clearMessages,
    updateConfig,
  } = useChat()

  // 兼容旧版本的接口
  const initializeOpenAI = (apiKey: string, baseURL?: string) => {
    updateConfig({
      apiKey,
      baseURL: baseURL || 'https://api.openai.com/v1',
    })
  }

  const getChatInstance = () => {
    return {
      sendMessage: async (content: string, callbacks?: any) => {
        if (callbacks) {
          // 如果提供了旧版本的回调，需要适配
          console.warn('使用了旧版本的回调接口，建议升级到新版本')
        }
        await sendMessage(content)
      },
    }
  }

  return {
    messages,
    isTyping,
    currentResponse,
    error,
    config,
    character,
    sendMessage,
    clearMessages,
    updateConfig,
    initializeOpenAI,
    getChatInstance,
  }
}

/**
 * 人设管理钩子
 */
export function useCharacters() {
  const characters = ref<Character[]>([])
  const currentCharacter = ref<Character | null>(null)

  const loadCharacters = async () => {
    characters.value = await characterService.getAllCharacters()
    currentCharacter.value = await characterService.getCurrentCharacterAsync()
  }

  const createCharacter = async (characterData: Omit<Character, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newCharacter = await characterService.createCharacter(characterData)
    await loadCharacters()
    return newCharacter
  }

  const updateCharacter = async (id: string, updates: Partial<Character>) => {
    const updated = await characterService.updateCharacter(id, updates)
    await loadCharacters()
    return updated
  }

  const deleteCharacter = async (id: string) => {
    const success = await characterService.deleteCharacter(id)
    if (success) {
      await loadCharacters()
    }
    return success
  }

  const setCurrentCharacter = async (id: string) => {
    await characterService.setCurrentCharacter(id)
    await loadCharacters()
  }

  onMounted(async () => {
    await loadCharacters()
  })

  return {
    characters,
    currentCharacter,
    createCharacter,
    updateCharacter,
    deleteCharacter,
    setCurrentCharacter,
    loadCharacters,
  }
}

// 记忆管理相关的异步函数
async function searchMemoriesService(query: string, limit?: number) {
  const results = await memoryService.searchMemories(query, limit)
  return results
}

async function getRecentMemoriesService(limit?: number) {
  return await memoryService.getRecentMemories(limit)
}

async function addMemoryService(memoryData: any) {
  return await memoryService.addMemory(memoryData)
}

async function deleteMemoryService(id: string) {
  return await memoryService.deleteMemory(id)
}

/**
 * 记忆管理钩子
 */
export function useMemories() {
  const memories = ref<any[]>([])
  const memoryStats = ref<any>({})

  const searchMemories = searchMemoriesService
  const getRecentMemories = getRecentMemoriesService
  const addMemory = addMemoryService
  const deleteMemory = deleteMemoryService

  const getStats = async () => {
    memoryStats.value = await memoryService.getMemoryStats()
    return memoryStats.value
  }

  const clearAllMemories = async () => {
    // 注意：memoryService 中没有 clearAllMemories 方法，这里需要修复
    const allMemories = await memoryService.getRecentMemories(1000) // 获取大量记忆
    for (const memory of allMemories) {
      await memoryService.deleteMemory(memory.id)
    }
    memories.value = []
  }

  return {
    memories,
    memoryStats,
    searchMemories,
    getRecentMemories,
    addMemory,
    deleteMemory,
    getStats,
    clearAllMemories,
  }
}
