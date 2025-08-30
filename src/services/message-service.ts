/**
 * 消息管理服务
 * 负责管理聊天会话、消息历史和消息元数据
 */

import type { ExtendedMessage, MessageService, ChatSession } from '../types/chat'

const SESSIONS_STORAGE_KEY = 'chat-sessions'
const CURRENT_SESSION_KEY = 'current-session-id'
const MAX_SESSIONS = 50 // 最大会话数量
const MAX_MESSAGES_PER_SESSION = 200 // 每个会话最大消息数

class MessageServiceImpl implements MessageService {
  private sessions: Map<string, ChatSession> = new Map()
  private currentSessionId: string | null = null

  constructor() {
    this.loadFromStorage()
    this.initializeCurrentSession()
  }

  private generateId(): string {
    return Date.now().toString() + Math.random().toString(36).substring(2)
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(SESSIONS_STORAGE_KEY)
      if (stored) {
        const sessionsArray: ChatSession[] = JSON.parse(stored)
        this.sessions.clear()
        sessionsArray.forEach(session => {
          this.sessions.set(session.id, session)
        })
      }

      const currentId = localStorage.getItem(CURRENT_SESSION_KEY)
      if (currentId && this.sessions.has(currentId)) {
        this.currentSessionId = currentId
      }
    } catch (error) {
      console.error('加载会话数据失败:', error)
    }
  }

  private saveToStorage(): void {
    try {
      const sessionsArray = Array.from(this.sessions.values())
      localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessionsArray))
      
      if (this.currentSessionId) {
        localStorage.setItem(CURRENT_SESSION_KEY, this.currentSessionId)
      }
    } catch (error) {
      console.error('保存会话数据失败:', error)
    }
  }

  private initializeCurrentSession(): void {
    if (!this.currentSessionId || !this.sessions.has(this.currentSessionId)) {
      // 创建默认会话
      const newSession = this.createSession('default-character')
      this.currentSessionId = newSession.id
      localStorage.setItem(CURRENT_SESSION_KEY, newSession.id)
    }
  }

  private createSession(characterId: string, name?: string): ChatSession {
    const id = this.generateId()
    const now = Date.now()
    
    const session: ChatSession = {
      id,
      characterId,
      name: name || `会话 ${new Date().toLocaleString()}`,
      messages: [],
      createdAt: now,
      updatedAt: now,
      metadata: {
        totalTokens: 0,
        messageCount: 0,
        lastActivity: now
      }
    }

    this.sessions.set(id, session)
    this.cleanupOldSessions()
    this.saveToStorage()
    
    return session
  }

  private cleanupOldSessions(): void {
    if (this.sessions.size <= MAX_SESSIONS) {
      return
    }

    // 获取所有会话并按最后更新时间排序
    const sessionsArray = Array.from(this.sessions.values())
    sessionsArray.sort((a, b) => b.updatedAt - a.updatedAt)

    // 保留最近的 MAX_SESSIONS 个会话
    const toDelete = sessionsArray.slice(MAX_SESSIONS)

    toDelete.forEach(session => {
      this.sessions.delete(session.id)
    })

    console.log(`会话清理完成，删除了 ${toDelete.length} 个旧会话`)
  }

  private updateSessionMetadata(sessionId: string, message: ExtendedMessage): void {
    const session = this.sessions.get(sessionId)
    if (!session) return

    const tokenCount = message.metadata?.tokenCount || 0
    session.metadata = {
      ...session.metadata,
      totalTokens: (session.metadata?.totalTokens || 0) + tokenCount,
      messageCount: session.messages.length,
      lastActivity: Date.now()
    }
    
    session.updatedAt = Date.now()
  }

  addMessage(sessionId: string, message: Omit<ExtendedMessage, 'id' | 'timestamp'>): ExtendedMessage {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`会话 ${sessionId} 不存在`)
    }

    const id = this.generateId()
    const timestamp = Date.now()
    
    const newMessage: ExtendedMessage = {
      ...message,
      id,
      timestamp
    }

    session.messages.push(newMessage)
    
    // 限制消息数量
    if (session.messages.length > MAX_MESSAGES_PER_SESSION) {
      const excess = session.messages.length - MAX_MESSAGES_PER_SESSION
      session.messages.splice(0, excess)
      console.log(`会话 ${sessionId} 消息数量超限，删除了 ${excess} 条旧消息`)
    }

    this.updateSessionMetadata(sessionId, newMessage)
    this.saveToStorage()
    
    return newMessage
  }

  getMessages(sessionId: string, limit?: number): ExtendedMessage[] {
    const session = this.sessions.get(sessionId)
    if (!session) {
      return []
    }

    const messages = [...session.messages]
    return limit ? messages.slice(-limit) : messages
  }

  updateMessage(messageId: string, updates: Partial<ExtendedMessage>): ExtendedMessage {
    // 在所有会话中查找消息
    for (const session of this.sessions.values()) {
      const messageIndex = session.messages.findIndex(msg => msg.id === messageId)
      
      if (messageIndex !== -1) {
        const existingMessage = session.messages[messageIndex]
        const updatedMessage: ExtendedMessage = {
          ...existingMessage,
          ...updates,
          id: existingMessage.id, // 确保 ID 不会被覆盖
          timestamp: existingMessage.timestamp // 保持原始时间戳
        }

        session.messages[messageIndex] = updatedMessage
        session.updatedAt = Date.now()
        this.saveToStorage()
        
        return updatedMessage
      }
    }

    throw new Error(`消息 ${messageId} 不存在`)
  }

  deleteMessage(messageId: string): boolean {
    for (const session of this.sessions.values()) {
      const messageIndex = session.messages.findIndex(msg => msg.id === messageId)
      
      if (messageIndex !== -1) {
        session.messages.splice(messageIndex, 1)
        session.updatedAt = Date.now()
        this.updateSessionMetadata(session.id, session.messages[session.messages.length - 1] || { metadata: { tokenCount: 0 } } as ExtendedMessage)
        this.saveToStorage()
        return true
      }
    }

    return false
  }

  clearMessages(sessionId: string): boolean {
    const session = this.sessions.get(sessionId)
    if (!session) {
      return false
    }

    session.messages = []
    session.metadata = {
      ...session.metadata,
      totalTokens: 0,
      messageCount: 0,
      lastActivity: Date.now()
    }
    session.updatedAt = Date.now()
    this.saveToStorage()
    
    return true
  }

  searchMessages(query: string, sessionId?: string): ExtendedMessage[] {
    if (!query.trim()) {
      return []
    }

    const queryLower = query.toLowerCase()
    const results: ExtendedMessage[] = []

    const sessionsToSearch = sessionId 
      ? [this.sessions.get(sessionId)].filter(Boolean) as ChatSession[]
      : Array.from(this.sessions.values())

    for (const session of sessionsToSearch) {
      for (const message of session.messages) {
        if (message.content.toLowerCase().includes(queryLower)) {
          results.push(message)
        }
      }
    }

    // 按时间戳排序
    return results.sort((a, b) => b.timestamp - a.timestamp)
  }

  // 会话管理方法
  getCurrentSession(): ChatSession | null {
    if (!this.currentSessionId) {
      return null
    }
    return this.sessions.get(this.currentSessionId) || null
  }

  setCurrentSession(sessionId: string): void {
    if (!this.sessions.has(sessionId)) {
      throw new Error(`会话 ${sessionId} 不存在`)
    }
    
    this.currentSessionId = sessionId
    localStorage.setItem(CURRENT_SESSION_KEY, sessionId)
  }

  createNewSession(characterId: string, name?: string): ChatSession {
    const session = this.createSession(characterId, name)
    this.setCurrentSession(session.id)
    return session
  }

  getAllSessions(): ChatSession[] {
    return Array.from(this.sessions.values())
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }

  deleteSession(sessionId: string): boolean {
    if (!this.sessions.has(sessionId)) {
      return false
    }

    this.sessions.delete(sessionId)
    
    // 如果删除的是当前会话，切换到其他会话或创建新会话
    if (this.currentSessionId === sessionId) {
      const remaining = Array.from(this.sessions.values())
      if (remaining.length > 0) {
        this.setCurrentSession(remaining[0].id)
      } else {
        // 创建新的默认会话
        const newSession = this.createSession('default-character')
        this.setCurrentSession(newSession.id)
      }
    }

    this.saveToStorage()
    return true
  }

  updateSession(sessionId: string, updates: Partial<Pick<ChatSession, 'name' | 'characterId'>>): ChatSession {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`会话 ${sessionId} 不存在`)
    }

    const updatedSession: ChatSession = {
      ...session,
      ...updates,
      id: session.id, // 确保 ID 不会被覆盖
      updatedAt: Date.now()
    }

    this.sessions.set(sessionId, updatedSession)
    this.saveToStorage()
    
    return updatedSession
  }

  // 辅助方法：获取消息统计信息
  getMessageStats(sessionId?: string): {
    totalMessages: number
    messagesByRole: Record<string, number>
    totalTokens: number
    avgMessageLength: number
    timeSpan: { start: number | null, end: number | null }
  } {
    const sessions = sessionId ? [this.sessions.get(sessionId)].filter(Boolean) as ChatSession[] : Array.from(this.sessions.values())
    
    let allMessages: ExtendedMessage[] = []
    let totalTokens = 0
    
    sessions.forEach(session => {
      allMessages = allMessages.concat(session.messages)
      totalTokens += session.metadata?.totalTokens || 0
    })

    const messagesByRole: Record<string, number> = {}
    let totalLength = 0
    let earliestTime: number | null = null
    let latestTime: number | null = null

    allMessages.forEach(message => {
      messagesByRole[message.role] = (messagesByRole[message.role] || 0) + 1
      totalLength += message.content.length
      
      if (earliestTime === null || message.timestamp < earliestTime) {
        earliestTime = message.timestamp
      }
      if (latestTime === null || message.timestamp > latestTime) {
        latestTime = message.timestamp
      }
    })

    return {
      totalMessages: allMessages.length,
      messagesByRole,
      totalTokens,
      avgMessageLength: allMessages.length > 0 ? totalLength / allMessages.length : 0,
      timeSpan: {
        start: earliestTime,
        end: latestTime
      }
    }
  }

  // 辅助方法：导出会话数据
  exportSession(sessionId: string): string | null {
    const session = this.sessions.get(sessionId)
    if (!session) {
      return null
    }
    
    return JSON.stringify(session, null, 2)
  }

  // 辅助方法：导入会话数据
  importSession(sessionData: string): ChatSession {
    try {
      const session: ChatSession = JSON.parse(sessionData)
      
      // 验证必需字段
      if (!session.characterId || !session.messages) {
        throw new Error('会话数据不完整')
      }

      // 生成新的会话 ID 以避免冲突
      const newId = this.generateId()
      const importedSession: ChatSession = {
        ...session,
        id: newId,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      this.sessions.set(newId, importedSession)
      this.cleanupOldSessions()
      this.saveToStorage()
      
      return importedSession
    } catch (error) {
      throw new Error(`导入会话失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  // 辅助方法：清空所有数据
  clearAllData(): void {
    this.sessions.clear()
    this.currentSessionId = null
    localStorage.removeItem(SESSIONS_STORAGE_KEY)
    localStorage.removeItem(CURRENT_SESSION_KEY)
    
    // 重新初始化默认会话
    this.initializeCurrentSession()
  }
}

// 创建单例实例
export const messageService = new MessageServiceImpl()

export { type ExtendedMessage, type ChatSession }