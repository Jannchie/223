/**
 * 会话数据访问仓库
 * 提供会话相关的数据库操作
 */

import type { ChatSession } from '../../types/chat'
import { db } from '../index'

export class SessionRepository {
  /**
   * 创建新会话
   */
  async create(session: Omit<ChatSession, 'id'>): Promise<ChatSession> {
    const id = await db.sessions.add({
      ...session,
      id: undefined as any, // Dexie 会自动生成
    })

    return await this.getById(id as string) as ChatSession
  }

  /**
   * 根据 ID 获取会话
   */
  async getById(id: string): Promise<ChatSession | null> {
    const session = await db.sessions.get(id)
    return session || null
  }

  /**
   * 获取所有会话
   */
  async getAll(): Promise<ChatSession[]> {
    const sessions = await db.sessions.toArray()
    // 手动排序，按更新时间降序
    sessions.sort((a, b) => b.updatedAt - a.updatedAt)
    return sessions
  }

  /**
   * 根据角色ID获取会话
   */
  async getByCharacterId(characterId: string): Promise<ChatSession[]> {
    const sessions = await db.sessions
      .where('characterId')
      .equals(characterId)
      .toArray()

    // 手动排序，按更新时间降序
    sessions.sort((a, b) => b.updatedAt - a.updatedAt)
    return sessions
  }

  /**
   * 更新会话
   */
  async update(id: string, updates: Partial<ChatSession>): Promise<ChatSession | null> {
    await db.sessions.update(id, updates)
    return await this.getById(id)
  }

  /**
   * 删除会话
   */
  async delete(id: string): Promise<boolean> {
    const count = await db.sessions.where('id').equals(id).delete()
    return count > 0
  }

  /**
   * 批量删除会话
   */
  async deleteMany(ids: string[]): Promise<number> {
    return await db.sessions.where('id').anyOf(ids).delete()
  }

  /**
   * 清理旧会话（保留最新的 N 个）
   */
  async cleanupOldSessions(keepCount: number = 50): Promise<number> {
    const allSessions = await db.sessions.orderBy('updatedAt').reverse().toArray()

    if (allSessions.length <= keepCount) {
      return 0
    }

    const sessionsToDelete = allSessions.slice(keepCount)
    const idsToDelete = sessionsToDelete.map(s => s.id)

    return await this.deleteMany(idsToDelete)
  }

  /**
   * 根据时间范围获取会话
   */
  async getByDateRange(startTime: number, endTime: number): Promise<ChatSession[]> {
    const sessions = await db.sessions
      .where('updatedAt')
      .between(startTime, endTime)
      .toArray()

    // 手动排序，按更新时间降序
    sessions.sort((a, b) => b.updatedAt - a.updatedAt)
    return sessions
  }

  /**
   * 搜索会话（根据名称）
   */
  async search(query: string): Promise<ChatSession[]> {
    return await db.sessions
      .filter(session =>
        session.name?.toLowerCase().includes(query.toLowerCase()) ?? false,
      )
      .toArray()
  }

  /**
   * 获取会话数量
   */
  async count(): Promise<number> {
    return await db.sessions.count()
  }

  /**
   * 获取最近活跃的会话
   */
  async getRecentActive(limit: number = 10): Promise<ChatSession[]> {
    const sessions = await db.sessions.toArray()
    // 手动排序并限制数量
    sessions.sort((a, b) => b.updatedAt - a.updatedAt)
    return sessions.slice(0, limit)
  }

  /**
   * 更新会话的最后活动时间
   */
  async touchSession(id: string): Promise<void> {
    await db.sessions.update(id, {
      'updatedAt': Date.now(),
      'metadata.lastActivity': Date.now(),
    })
  }

  /**
   * 批量操作：事务中执行多个操作
   */
  async batchOperation<T>(
    operations: (transaction: typeof db.sessions) => Promise<T>,
  ): Promise<T> {
    return await db.transaction('rw', db.sessions, async () => {
      return await operations(db.sessions)
    })
  }
}
