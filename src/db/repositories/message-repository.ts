/**
 * 消息数据访问仓库
 * 提供消息相关的数据库操作
 */

import type { ExtendedMessage } from '../../types/chat'
import { db } from '../index'

export class MessageRepository {
  /**
   * 添加新消息
   */
  async create(message: Omit<ExtendedMessage, 'id' | 'timestamp'> & { sessionId: string }): Promise<ExtendedMessage> {
    const id = await db.messages.add({
      ...message,
      timestamp: Date.now(),
      id: undefined as any, // Dexie 会自动生成
    })

    return await this.getById(id as string) as ExtendedMessage
  }

  /**
   * 根据 ID 获取消息
   */
  async getById(id: string): Promise<ExtendedMessage | null> {
    const message = await db.messages.get(id)
    return message || null
  }

  /**
   * 获取会话的所有消息
   */
  async getBySessionId(sessionId: string, limit?: number): Promise<ExtendedMessage[]> {
    const query = db.messages
      .where('sessionId')
      .equals(sessionId)

    const messages = await query.toArray()

    // 手动排序
    messages.sort((a, b) => a.timestamp - b.timestamp)

    if (limit) {
      return messages.slice(0, limit)
    }

    return messages
  }

  /**
   * 获取会话的最新消息
   */
  async getRecentBySessionId(sessionId: string, limit: number = 50): Promise<ExtendedMessage[]> {
    const messages = await db.messages
      .where('sessionId')
      .equals(sessionId)
      .toArray()

    // 手动排序并取最新的
    messages.sort((a, b) => b.timestamp - a.timestamp)

    return messages.slice(0, limit)
  }

  /**
   * 更新消息
   */
  async update(id: string, updates: Partial<ExtendedMessage>): Promise<ExtendedMessage | null> {
    await db.messages.update(id, updates)
    return await this.getById(id)
  }

  /**
   * 删除消息
   */
  async delete(id: string): Promise<boolean> {
    const count = await db.messages.where('id').equals(id).delete()
    return count > 0
  }

  /**
   * 删除会话的所有消息
   */
  async deleteBySessionId(sessionId: string): Promise<number> {
    return await db.messages.where('sessionId').equals(sessionId).delete()
  }

  /**
   * 批量删除消息
   */
  async deleteMany(ids: string[]): Promise<number> {
    return await db.messages.where('id').anyOf(ids).delete()
  }

  /**
   * 搜索消息内容
   */
  async search(query: string, sessionId?: string): Promise<ExtendedMessage[]> {
    let collection = db.messages.toCollection()

    if (sessionId) {
      collection = db.messages.where('sessionId').equals(sessionId)
    }

    const messages = await collection
      .filter(message =>
        message.content.toLowerCase().includes(query.toLowerCase()),
      )
      .toArray()

    // 手动排序，按时间戳降序
    messages.sort((a, b) => b.timestamp - a.timestamp)
    return messages
  }

  /**
   * 根据角色获取消息
   */
  async getByRole(role: string, sessionId?: string): Promise<ExtendedMessage[]> {
    const messages = await (sessionId
      ? db.messages
          .where('sessionId')
          .equals(sessionId)
          .and(message => message.role === role)
          .toArray()
      : db.messages
          .where('role')
          .equals(role)
          .toArray())

    // 手动排序
    messages.sort((a, b) => b.timestamp - a.timestamp)
    return messages
  }

  /**
   * 获取消息数量
   */
  async count(sessionId?: string): Promise<number> {
    if (sessionId) {
      return await db.messages.where('sessionId').equals(sessionId).count()
    }
    return await db.messages.count()
  }

  /**
   * 清理会话中的旧消息（保留最新的 N 条）
   */
  async cleanupOldMessages(sessionId: string, keepCount: number = 200): Promise<number> {
    const messages = await db.messages
      .where('sessionId')
      .equals(sessionId)
      .toArray()

    // 手动排序，按时间戳降序
    messages.sort((a, b) => b.timestamp - a.timestamp)

    if (messages.length <= keepCount) {
      return 0
    }

    const messagesToDelete = messages.slice(keepCount)
    const idsToDelete = messagesToDelete.map((m: ExtendedMessage) => m.id)

    return await this.deleteMany(idsToDelete)
  }

  /**
   * 根据时间范围获取消息
   */
  async getByTimeRange(
    startTime: number,
    endTime: number,
    sessionId?: string,
  ): Promise<ExtendedMessage[]> {
    const messages = await (sessionId
      ? db.messages
          .where('sessionId')
          .equals(sessionId)
          .and(message => message.timestamp >= startTime && message.timestamp <= endTime)
          .toArray()
      : db.messages
          .where('timestamp')
          .between(startTime, endTime)
          .toArray())

    // 手动排序
    messages.sort((a, b) => a.timestamp - b.timestamp)
    return messages
  }

  /**
   * 获取带错误的消息
   */
  async getMessagesWithErrors(sessionId?: string): Promise<ExtendedMessage[]> {
    const messages = await (sessionId
      ? db.messages
          .where('sessionId')
          .equals(sessionId)
          .toArray()
      : db.messages.toArray())

    return messages.filter(message => message.metadata?.error)
  }

  /**
   * 获取正在处理的消息
   */
  async getProcessingMessages(sessionId?: string): Promise<ExtendedMessage[]> {
    const messages = await (sessionId
      ? db.messages
          .where('sessionId')
          .equals(sessionId)
          .toArray()
      : db.messages.toArray())

    return messages.filter(message => message.metadata?.processing === true)
  }

  /**
   * 标记消息为完成处理
   */
  async markAsCompleted(id: string): Promise<void> {
    await db.messages.update(id, {
      'metadata.processing': false,
    })
  }

  /**
   * 批量添加消息
   */
  async bulkAdd(messages: (Omit<ExtendedMessage, 'id' | 'timestamp'> & { sessionId: string })[]): Promise<string[]> {
    const ids = await db.messages.bulkAdd(
      messages.map(msg => ({ ...msg, timestamp: Date.now(), id: undefined as any })),
      { allKeys: true },
    )
    return ids as string[]
  }

  /**
   * 获取会话统计信息
   */
  async getSessionStats(sessionId: string): Promise<{
    totalMessages: number
    userMessages: number
    assistantMessages: number
    totalTokens: number
    firstMessageTime?: number
    lastMessageTime?: number
  }> {
    const messages = await this.getBySessionId(sessionId)

    const userMessages = messages.filter(m => m.role === 'user').length
    const assistantMessages = messages.filter(m => m.role === 'assistant').length
    const totalTokens = messages.reduce((sum, m) => sum + (m.metadata?.tokenCount || 0), 0)

    return {
      totalMessages: messages.length,
      userMessages,
      assistantMessages,
      totalTokens,
      firstMessageTime: messages[0]?.timestamp,
      lastMessageTime: messages.at(-1)?.timestamp,
    }
  }

  /**
   * 批量操作：事务中执行多个操作
   */
  async batchOperation<T>(
    operations: (transaction: typeof db.messages) => Promise<T>,
  ): Promise<T> {
    return await db.transaction('rw', db.messages, async () => {
      return await operations(db.messages)
    })
  }
}
