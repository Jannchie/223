/**
 * 消息管理服务
 * 负责管理聊天会话、消息历史和消息元数据
 * 现在使用 IndexedDB 作为存储后端
 */

import type { ChatSession, ExtendedMessage, MessageService } from '../types/chat'
import { useLocalStorage } from '@vueuse/core'
import { repositories } from '../composables/useDatabase'
import { initializeDatabase } from '../db'
import { migrateFromLocalStorage, needsMigration } from '../db/migration'

const MAX_SESSIONS = 50 // 最大会话数量
const MAX_MESSAGES_PER_SESSION = 200 // 每个会话最大消息数

class MessageServiceImpl implements MessageService {
  private currentSessionId: string | null = null
  private initialized = false
  private sessionIdStorage = useLocalStorage('current-session-id', '')

  constructor() {
    // 不在构造函数中调用异步初始化，让它在第一次使用时初始化
  }

  private async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    try {
      // 初始化数据库
      await initializeDatabase()

      // 检查是否需要迁移数据
      if (needsMigration()) {
        console.log('检测到旧数据，开始迁移...')
        const result = await migrateFromLocalStorage()
        if (result.success) {
          console.log('数据迁移完成')
        }
        else {
          console.warn('数据迁移有警告:', result.errors)
        }
      }

      this.initialized = true
      await this.initializeCurrentSession()
    }
    catch (error) {
      console.error('消息服务初始化失败:', error)
      throw error
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize()
    }
  }

  private async initializeCurrentSession(): Promise<void> {
    try {
      // 先检查是否有保存的会话 ID
      if (this.sessionIdStorage.value) {
        const savedSession = await repositories.sessions.getById(this.sessionIdStorage.value)
        if (savedSession) {
          this.currentSessionId = savedSession.id
          console.log('恢复保存的会话:', this.currentSessionId)
          return
        }
        else {
          // 保存的会话不存在，清空存储
          this.sessionIdStorage.value = ''
        }
      }

      // 获取最近的会话作为当前会话
      const recentSessions = await repositories.sessions.getRecentActive(1)
      if (recentSessions.length > 0) {
        this.currentSessionId = recentSessions[0].id
        this.sessionIdStorage.value = this.currentSessionId
        console.log('使用最近的会话:', this.currentSessionId)
      }
      else {
        // 如果没有任何会话，创建默认会话
        const characterId = 'default' // 使用默认人设ID
        const defaultSession = await this.createSession(characterId, '默认会话')
        this.currentSessionId = defaultSession.id
        this.sessionIdStorage.value = this.currentSessionId
        console.log('创建默认会话:', defaultSession.id)
      }
    }
    catch (error) {
      console.warn('初始化当前会话失败:', error)
    }
  }

  private async createSession(characterId: string, name?: string): Promise<ChatSession> {
    await this.ensureInitialized()

    const session = await repositories.sessions.create({
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

    // 清理旧会话
    await repositories.sessions.cleanupOldSessions(MAX_SESSIONS)

    return session
  }

  async addMessage(sessionId: string, message: Omit<ExtendedMessage, 'id' | 'timestamp'>): Promise<ExtendedMessage> {
    await this.ensureInitialized()

    // 检查会话是否存在
    const session = await repositories.sessions.getById(sessionId)
    if (!session) {
      throw new Error(`会话 ${sessionId} 不存在`)
    }

    // 添加消息
    const fullMessage = await repositories.messages.create({
      ...message,
      sessionId,
    })

    // 更新会话元数据
    const messageCount = await repositories.messages.count(sessionId)
    await repositories.sessions.update(sessionId, {
      updatedAt: Date.now(),
      metadata: {
        ...session.metadata,
        messageCount,
        lastActivity: Date.now(),
      },
    })

    // 清理过多的消息
    if (messageCount > MAX_MESSAGES_PER_SESSION) {
      await repositories.messages.cleanupOldMessages(sessionId, MAX_MESSAGES_PER_SESSION)
    }

    return fullMessage
  }

  async getMessages(sessionId: string, limit?: number): Promise<ExtendedMessage[]> {
    await this.ensureInitialized()

    return await (limit ? repositories.messages.getRecentBySessionId(sessionId, limit) : repositories.messages.getBySessionId(sessionId))
  }

  async updateMessage(messageId: string, updates: Partial<ExtendedMessage>): Promise<ExtendedMessage> {
    await this.ensureInitialized()

    const updatedMessage = await repositories.messages.update(messageId, updates)
    if (!updatedMessage) {
      throw new Error(`消息 ${messageId} 不存在`)
    }

    return updatedMessage
  }

  async deleteMessage(messageId: string): Promise<boolean> {
    await this.ensureInitialized()
    return await repositories.messages.delete(messageId)
  }

  async clearMessages(sessionId: string): Promise<boolean> {
    await this.ensureInitialized()

    const deleted = await repositories.messages.deleteBySessionId(sessionId)

    // 更新会话元数据
    if (deleted > 0) {
      await repositories.sessions.update(sessionId, {
        updatedAt: Date.now(),
        metadata: {
          messageCount: 0,
          totalTokens: 0,
          lastActivity: Date.now(),
        },
      })
    }

    return deleted > 0
  }

  async searchMessages(query: string, sessionId?: string): Promise<ExtendedMessage[]> {
    await this.ensureInitialized()
    return await repositories.messages.search(query, sessionId)
  }

  // 会话管理方法
  async createNewSession(characterId: string, name?: string): Promise<ChatSession> {
    const session = await this.createSession(characterId, name)
    this.currentSessionId = session.id
    this.sessionIdStorage.value = session.id
    console.log('创建并设置新会话:', session.id)
    return session
  }

  async getAllSessions(): Promise<ChatSession[]> {
    await this.ensureInitialized()
    return await repositories.sessions.getAll()
  }

  async getSession(sessionId: string): Promise<ChatSession | null> {
    await this.ensureInitialized()
    return await repositories.sessions.getById(sessionId)
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    await this.ensureInitialized()

    // 删除会话的所有消息
    await repositories.messages.deleteBySessionId(sessionId)

    // 删除会话
    const deleted = await repositories.sessions.delete(sessionId)

    // 如果删除的是当前会话，重置当前会话ID
    if (deleted && this.currentSessionId === sessionId) {
      this.currentSessionId = null
      this.sessionIdStorage.value = ''
      console.log('删除当前会话，已清空会话ID')
    }

    return deleted
  }

  getCurrentSessionId(): string | null {
    return this.currentSessionId
  }

  async setCurrentSession(sessionId: string): Promise<void> {
    await this.ensureInitialized()

    const session = await repositories.sessions.getById(sessionId)
    if (!session) {
      throw new Error(`会话 ${sessionId} 不存在`)
    }

    this.currentSessionId = sessionId
    this.sessionIdStorage.value = sessionId
    await repositories.sessions.touchSession(sessionId)
    console.log('设置当前会话:', sessionId)
  }

  async getCurrentSession(): Promise<ChatSession | null> {
    await this.ensureInitialized()

    if (!this.currentSessionId) {
      // 如果没有当前会话，尝试重新初始化
      await this.initializeCurrentSession()

      if (!this.currentSessionId) {
        return null
      }
    }

    const session = await repositories.sessions.getById(this.currentSessionId)

    if (!session && this.currentSessionId) {
      // 会话不存在，重置会话ID
      this.currentSessionId = null
      this.sessionIdStorage.value = ''
      return null
    }

    return session
  }

  async updateSession(sessionId: string, updates: Partial<Pick<ChatSession, 'name' | 'characterId'>>): Promise<ChatSession> {
    await this.ensureInitialized()

    const updated = await repositories.sessions.update(sessionId, updates)
    if (!updated) {
      throw new Error(`会话 ${sessionId} 不存在`)
    }

    return updated
  }

  // 数据清理方法
  async clearAllSessions(): Promise<void> {
    await this.ensureInitialized()

    // 清空所有消息和会话
    await repositories.sessions.batchOperation(async () => {
      await repositories.messages.batchOperation(async () => {
        const sessions = await repositories.sessions.getAll()
        for (const session of sessions) {
          await repositories.messages.deleteBySessionId(session.id)
        }
      })

      const allSessions = await repositories.sessions.getAll()
      const sessionIds = allSessions.map(s => s.id)
      await repositories.sessions.deleteMany(sessionIds)
    })

    this.currentSessionId = null
    this.sessionIdStorage.value = ''
    console.log('清空所有会话，已重置会话ID')
  }

  // 统计方法
  async getSessionCount(): Promise<number> {
    await this.ensureInitialized()
    return await repositories.sessions.count()
  }

  async getTotalMessageCount(): Promise<number> {
    await this.ensureInitialized()
    return await repositories.messages.count()
  }

  async getSessionStats(sessionId: string): Promise<{
    messageCount: number
    totalTokens: number
    lastActivity: number
  } | null> {
    await this.ensureInitialized()

    const session = await repositories.sessions.getById(sessionId)
    if (!session) {
      return null
    }

    const stats = await repositories.messages.getSessionStats(sessionId)

    return {
      messageCount: stats.totalMessages,
      totalTokens: stats.totalTokens,
      lastActivity: session.metadata?.lastActivity || session.updatedAt,
    }
  }

  // 辅助方法：获取消息统计信息
  async getMessageStats(sessionId?: string): Promise<{
    totalMessages: number
    messagesByRole: Record<string, number>
    totalTokens: number
    avgMessageLength: number
    timeSpan: { start: number | null, end: number | null }
  }> {
    await this.ensureInitialized()

    const messages = sessionId
      ? await repositories.messages.getBySessionId(sessionId)
      : await repositories.messages.batchOperation(async () => {
          // 获取所有消息（这里需要优化，避免加载所有消息）
          const sessions = await repositories.sessions.getAll()
          const allMessages: ExtendedMessage[] = []
          for (const session of sessions) {
            const sessionMessages = await repositories.messages.getBySessionId(session.id)
            allMessages.push(...sessionMessages)
          }
          return allMessages
        })

    const messagesByRole: Record<string, number> = {}
    let totalLength = 0
    let totalTokens = 0
    let earliestTime: number | null = null
    let latestTime: number | null = null

    for (const message of messages) {
      messagesByRole[message.role] = (messagesByRole[message.role] || 0) + 1
      totalLength += message.content.length
      totalTokens += message.metadata?.tokenCount || 0

      if (earliestTime === null || message.timestamp < earliestTime) {
        earliestTime = message.timestamp
      }
      if (latestTime === null || message.timestamp > latestTime) {
        latestTime = message.timestamp
      }
    }

    return {
      totalMessages: messages.length,
      messagesByRole,
      totalTokens,
      avgMessageLength: messages.length > 0 ? totalLength / messages.length : 0,
      timeSpan: {
        start: earliestTime,
        end: latestTime,
      },
    }
  }

  // 辅助方法：导出会话数据
  async exportSession(sessionId: string): Promise<string | null> {
    await this.ensureInitialized()

    const session = await repositories.sessions.getById(sessionId)
    if (!session) {
      return null
    }

    const messages = await repositories.messages.getBySessionId(sessionId)
    const exportData = {
      ...session,
      messages,
    }

    return JSON.stringify(exportData, null, 2)
  }

  // 辅助方法：导入会话数据
  async importSession(sessionData: string): Promise<ChatSession> {
    await this.ensureInitialized()

    try {
      const data = JSON.parse(sessionData)

      // 验证必需字段
      if (!data.characterId) {
        throw new Error('会话数据不完整')
      }

      // 创建会话（去除原有的 id 和 messages）
      const { id, messages, ...sessionInfo } = data
      const newSession = await repositories.sessions.create({
        ...sessionInfo,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })

      // 导入消息
      if (messages && Array.isArray(messages)) {
        for (const message of messages) {
          const { id: messageId, ...messageData } = message
          await repositories.messages.create({
            ...messageData,
            sessionId: newSession.id,
          })
        }
      }

      return newSession
    }
    catch (error) {
      throw new Error(`导入会话失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  // 辅助方法：清空所有数据
  async clearAllData(): Promise<void> {
    await this.ensureInitialized()
    await this.clearAllSessions()
  }
}

// 创建单例实例
export const messageService = new MessageServiceImpl()

export { type ChatSession, type ExtendedMessage } from '../types/chat'
