/**
 * Vue 聊天组合式函数
 * 提供响应式的聊天状态管理和方法
 */

import { ref, watch, onMounted } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import type { 
  UseChatReturn,
  ExtendedMessage,
  ChatConfig,
  Character,
  AIProvider,
  ChatContext,
  StreamingCallbacks
} from '../types/chat'
import { chatService } from '../services/chat-service'
import { characterService } from '../services/character-service'
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
    model: 'gpt-4o',
    apiKey: '',
    baseURL: 'https://api.openai.com/v1',
    temperature: 0.7,
    maxTokens: 2000
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

  // 初始化
  onMounted(() => {
    loadCurrentCharacter()
    loadMessages()
  })

  /**
   * 加载当前人设
   */
  const loadCurrentCharacter = () => {
    const current = characterService.getCurrentCharacter()
    if (current) {
      character.value = current
    }
  }

  /**
   * 加载当前会话的消息
   */
  const loadMessages = () => {
    const currentSession = messageService.getCurrentSession()
    if (currentSession) {
      messages.value = currentSession.messages
    }
  }

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
      const currentSession = messageService.getCurrentSession()
      if (!currentSession) {
        throw new Error('没有活跃的聊天会话')
      }

      const userMessage = messageService.addMessage(currentSession.id, {
        role: 'user',
        content: content.trim(),
        metadata: {
          provider: config.value.provider,
          model: config.value.model
        }
      })

      // 更新本地消息列表
      messages.value.push(userMessage)

      // 开始响应生成
      isTyping.value = true
      currentResponse.value = ''

      // 获取相关记忆
      const relevantMemories = await chatService.getRelevantMemories(content)

      // 构建聊天上下文
      const chatContext: ChatContext = {
        character: character.value,
        recentMemories: relevantMemories,
        currentSession,
        config: config.value
      }

      // 准备流式回调
      const callbacks: StreamingCallbacks = {
        onToken: (token: string) => {
          currentResponse.value += token
        },
        onComplete: (fullContent: string) => {
          try {
            // 添加助手消息
            const assistantMessage = messageService.addMessage(currentSession.id, {
              role: 'assistant',
              content: fullContent,
              metadata: {
                provider: config.value.provider,
                model: config.value.model,
                tokenCount: chatService.estimateTokens(fullContent)
              }
            })

            // 更新本地消息列表
            messages.value.push(assistantMessage)

            // 重置状态
            isTyping.value = false
            currentResponse.value = ''

            // 从用户消息中提取记忆
            const userMemories = memoryService.extractMemoriesFromMessage(userMessage)
            userMemories.forEach(memoryData => {
              memoryService.addMemory(memoryData)
            })

          } catch (err) {
            console.error('处理完成回调失败:', err)
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
        }
      }

      // 发送消息
      await chatService.sendMessage(content, chatContext, callbacks)

    } catch (err) {
      console.error('发送消息失败:', err)
      error.value = err instanceof Error ? err.message : '发送消息失败'
      isTyping.value = false
    }
  }

  /**
   * 清空消息
   */
  const clearMessages = () => {
    const currentSession = messageService.getCurrentSession()
    if (currentSession) {
      messageService.clearMessages(currentSession.id)
      messages.value = []
    }
  }

  /**
   * 设置当前人设
   */
  const setCharacter = (characterId: string) => {
    try {
      characterService.setCurrentCharacter(characterId)
      loadCurrentCharacter()
      
      // 如果需要，可以创建新会话
      const currentSession = messageService.getCurrentSession()
      if (currentSession && currentSession.characterId !== characterId) {
        messageService.updateSession(currentSession.id, { characterId })
      }
    } catch (err) {
      console.error('设置人设失败:', err)
      error.value = err instanceof Error ? err.message : '设置人设失败'
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
    if (!chatService.validateConfig(config.value)) {
      error.value = '配置无效'
    } else {
      error.value = null
    }
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
    updateConfig
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
    updateConfig
  } = useChat()

  // 兼容旧版本的接口
  const initializeOpenAI = (apiKey: string, baseURL?: string) => {
    updateConfig({
      apiKey,
      baseURL: baseURL || 'https://api.openai.com/v1'
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
      }
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
    getChatInstance
  }
}

/**
 * 人设管理钩子
 */
export function useCharacters() {
  const characters = ref<Character[]>([])
  const currentCharacter = ref<Character | null>(null)

  const loadCharacters = () => {
    characters.value = characterService.getAllCharacters()
    currentCharacter.value = characterService.getCurrentCharacter()
  }

  const createCharacter = (characterData: Omit<Character, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newCharacter = characterService.createCharacter(characterData)
    loadCharacters()
    return newCharacter
  }

  const updateCharacter = (id: string, updates: Partial<Character>) => {
    const updated = characterService.updateCharacter(id, updates)
    loadCharacters()
    return updated
  }

  const deleteCharacter = (id: string) => {
    const success = characterService.deleteCharacter(id)
    if (success) {
      loadCharacters()
    }
    return success
  }

  const setCurrentCharacter = (id: string) => {
    characterService.setCurrentCharacter(id)
    loadCharacters()
  }

  onMounted(() => {
    loadCharacters()
  })

  return {
    characters,
    currentCharacter,
    createCharacter,
    updateCharacter,
    deleteCharacter,
    setCurrentCharacter,
    loadCharacters
  }
}

/**
 * 记忆管理钩子
 */
export function useMemories() {
  const memories = ref<any[]>([])
  const memoryStats = ref<any>({})

  const searchMemories = async (query: string, limit?: number) => {
    const results = memoryService.searchMemories(query, limit)
    return results
  }

  const getRecentMemories = (limit?: number) => {
    return memoryService.getRecentMemories(limit)
  }

  const addMemory = (memoryData: any) => {
    return memoryService.addMemory(memoryData)
  }

  const deleteMemory = (id: string) => {
    return memoryService.deleteMemory(id)
  }

  const getStats = () => {
    memoryStats.value = memoryService.getMemoryStats()
    return memoryStats.value
  }

  const clearAllMemories = () => {
    memoryService.clearAllMemories()
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
    clearAllMemories
  }
}