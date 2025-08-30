/**
 * 数据库组合式函数
 * 提供响应式的数据库访问和管理
 */

import type { Ref } from 'vue'
import type { Character, ChatSession, ExtendedMessage, Memory } from '../types/chat'
import { onMounted, reactive, ref } from 'vue'
import { db, getDatabaseStats, initializeDatabase } from '../db'
import { CharacterRepository } from '../db/repositories/character-repository'
import { MemoryRepository } from '../db/repositories/memory-repository'
import { MessageRepository } from '../db/repositories/message-repository'
import { SessionRepository } from '../db/repositories/session-repository'

// 仓库实例（单例）
const sessionRepo = new SessionRepository()
const messageRepo = new MessageRepository()
const characterRepo = new CharacterRepository()
const memoryRepo = new MemoryRepository()

// 响应式状态
const isInitialized = ref(false)
const isLoading = ref(false)
const error = ref<string | null>(null)

// 数据库统计
const stats = reactive({
  sessions: 0,
  messages: 0,
  characters: 0,
  memories: 0,
})

/**
 * 主要的数据库组合式函数
 */
export function useDatabase() {
  // 更新统计信息
  const updateStats = async (): Promise<void> => {
    try {
      const dbStats = await getDatabaseStats()
      Object.assign(stats, dbStats)
    }
    catch (error_) {
      console.warn('更新统计信息失败:', error_)
    }
  }

  // 初始化数据库
  const initialize = async (): Promise<void> => {
    if (isInitialized.value) {
      return
    }

    try {
      isLoading.value = true
      error.value = null

      await initializeDatabase()
      await updateStats()

      isInitialized.value = true
    }
    catch (error_) {
      error.value = error_ instanceof Error ? error_.message : '数据库初始化失败'
      throw error_
    }
    finally {
      isLoading.value = false
    }
  }

  // 自动初始化
  onMounted(() => {
    initialize()
  })

  return {
    // 状态
    isInitialized,
    isLoading,
    error,
    stats,

    // 方法
    initialize,
    updateStats,

    // 仓库访问
    sessions: sessionRepo,
    messages: messageRepo,
    characters: characterRepo,
    memories: memoryRepo,

    // 数据库直接访问（高级用法）
    db,
  }
}

/**
 * 会话管理组合式函数
 */
export function useSessions() {
  const sessions = ref<ChatSession[]>([])
  const currentSessionId = ref<string | null>(null)
  const currentSession = ref<ChatSession | null>(null)
  const loading = ref(false)

  // 加载所有会话
  const loadSessions = async (): Promise<void> => {
    try {
      loading.value = true
      sessions.value = await sessionRepo.getAll()
    }
    finally {
      loading.value = false
    }
  }

  // 创建新会话
  const createSession = async (characterId: string, name?: string): Promise<ChatSession> => {
    const session = await sessionRepo.create({
      characterId,
      name: name || `会话 ${new Date().toLocaleString()}`,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: {
        totalTokens: 0,
        messageCount: 0,
        lastActivity: Date.now(),
      },
    })

    sessions.value.unshift(session)
    return session
  }

  // 设置当前会话
  const setCurrentSession = async (sessionId: string): Promise<void> => {
    currentSessionId.value = sessionId
    currentSession.value = await sessionRepo.getById(sessionId)

    // 触摸会话（更新最后活动时间）
    if (currentSession.value) {
      await sessionRepo.touchSession(sessionId)
    }
  }

  // 删除会话
  const deleteSession = async (sessionId: string): Promise<void> => {
    await sessionRepo.delete(sessionId)
    sessions.value = sessions.value.filter(s => s.id !== sessionId)

    if (currentSessionId.value === sessionId) {
      currentSessionId.value = null
      currentSession.value = null
    }
  }

  return {
    sessions,
    currentSessionId,
    currentSession,
    loading,
    loadSessions,
    createSession,
    setCurrentSession,
    deleteSession,
  }
}

/**
 * 消息管理组合式函数
 */
export function useMessages(sessionId: Ref<string | null>) {
  const messages = ref<ExtendedMessage[]>([])
  const loading = ref(false)

  // 加载会话消息
  const loadMessages = async (): Promise<void> => {
    if (!sessionId.value) {
      messages.value = []
      return
    }

    try {
      loading.value = true
      messages.value = await messageRepo.getBySessionId(sessionId.value)
    }
    finally {
      loading.value = false
    }
  }

  // 添加消息
  const addMessage = async (message: Omit<ExtendedMessage, 'id' | 'timestamp'>): Promise<ExtendedMessage> => {
    if (!sessionId.value) {
      throw new Error('没有活跃的会话')
    }

    const newMessage = await messageRepo.create({
      ...message,
      sessionId: sessionId.value,
      timestamp: Date.now(),
    })

    messages.value.push(newMessage)
    return newMessage
  }

  // 更新消息
  const updateMessage = async (messageId: string, updates: Partial<ExtendedMessage>): Promise<void> => {
    const updated = await messageRepo.update(messageId, updates)
    if (updated) {
      const index = messages.value.findIndex(m => m.id === messageId)
      if (index !== -1) {
        messages.value[index] = updated
      }
    }
  }

  // 删除消息
  const deleteMessage = async (messageId: string): Promise<void> => {
    await messageRepo.delete(messageId)
    messages.value = messages.value.filter(m => m.id !== messageId)
  }

  // 清空消息
  const clearMessages = async (): Promise<void> => {
    if (!sessionId.value) {
      return
    }

    await messageRepo.deleteBySessionId(sessionId.value)
    messages.value = []
  }

  return {
    messages,
    loading,
    loadMessages,
    addMessage,
    updateMessage,
    deleteMessage,
    clearMessages,
  }
}

/**
 * 角色管理组合式函数
 */
export function useCharacters() {
  const characters = ref<Character[]>([])
  const currentCharacterId = ref<string | null>(null)
  const currentCharacter = ref<Character | null>(null)
  const loading = ref(false)

  // 加载所有角色
  const loadCharacters = async (): Promise<void> => {
    try {
      loading.value = true
      characters.value = await characterRepo.getAll()
    }
    finally {
      loading.value = false
    }
  }

  // 创建角色
  const createCharacter = async (characterData: Omit<Character, 'id' | 'createdAt' | 'updatedAt'>): Promise<Character> => {
    const character = await characterRepo.create(characterData)
    characters.value.unshift(character)
    return character
  }

  // 更新角色
  const updateCharacter = async (id: string, updates: Partial<Character>): Promise<void> => {
    const updated = await characterRepo.update(id, updates)
    if (updated) {
      const index = characters.value.findIndex(c => c.id === id)
      if (index !== -1) {
        characters.value[index] = updated
      }

      if (currentCharacterId.value === id) {
        currentCharacter.value = updated
      }
    }
  }

  // 删除角色
  const deleteCharacter = async (id: string): Promise<void> => {
    await characterRepo.delete(id)
    characters.value = characters.value.filter(c => c.id !== id)

    if (currentCharacterId.value === id) {
      currentCharacterId.value = null
      currentCharacter.value = null
    }
  }

  // 设置当前角色
  const setCurrentCharacter = async (id: string): Promise<void> => {
    currentCharacterId.value = id
    currentCharacter.value = await characterRepo.getById(id)
  }

  return {
    characters,
    currentCharacterId,
    currentCharacter,
    loading,
    loadCharacters,
    createCharacter,
    updateCharacter,
    deleteCharacter,
    setCurrentCharacter,
  }
}

/**
 * 记忆管理组合式函数
 */
export function useMemories() {
  const memories = ref<Memory[]>([])
  const loading = ref(false)

  // 加载记忆
  const loadMemories = async (limit?: number): Promise<void> => {
    try {
      loading.value = true
      memories.value = limit
        ? await memoryRepo.getRecent(limit)
        : await memoryRepo.getAll()
    }
    finally {
      loading.value = false
    }
  }

  // 添加记忆
  const addMemory = async (memoryData: Omit<Memory, 'id' | 'createdAt' | 'updatedAt' | 'lastAccessed'>): Promise<Memory> => {
    const memory = await memoryRepo.create(memoryData)
    memories.value.unshift(memory)
    return memory
  }

  // 搜索记忆
  const searchMemories = (query: string, limit?: number) => memoryRepo.search(query, limit)

  // 删除记忆
  const deleteMemory = async (id: string): Promise<void> => {
    await memoryRepo.delete(id)
    memories.value = memories.value.filter(m => m.id !== id)
  }

  return {
    memories,
    loading,
    loadMemories,
    addMemory,
    searchMemories,
    deleteMemory,
  }
}

/**
 * 数据迁移和管理组合式函数
 */
export function useDatabaseManagement() {
  const migrating = ref(false)
  const exportingData = ref(false)

  // 导出所有数据
  const exportAllData = async () => {
    try {
      exportingData.value = true

      const [sessions, characters, memories] = await Promise.all([
        sessionRepo.getAll(),
        characterRepo.exportAll(),
        memoryRepo.exportAll(),
      ])

      const exportData = {
        version: '1.0',
        timestamp: Date.now(),
        data: {
          sessions,
          characters,
          memories,
        },
      }

      return exportData
    }
    finally {
      exportingData.value = false
    }
  }

  // 清空所有数据
  const clearAllData = async (): Promise<void> => {
    await db.transaction('rw', db.sessions, db.messages, db.characters, db.memories, async () => {
      await Promise.all([
        db.sessions.clear(),
        db.messages.clear(),
        db.characters.clear(),
        db.memories.clear(),
      ])
    })
  }

  return {
    migrating,
    exportingData,
    exportAllData,
    clearAllData,
  }
}

// 导出所有仓库实例（用于直接访问）
export const repositories = {
  sessions: sessionRepo,
  messages: messageRepo,
  characters: characterRepo,
  memories: memoryRepo,
}
