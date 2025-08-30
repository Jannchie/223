/**
 * 记忆数据访问仓库
 * 提供记忆相关的数据库操作
 */

import type { Memory, MemorySearchResult } from '../../types/chat'
import { db } from '../index'

export class MemoryRepository {
  /**
   * 添加新记忆
   */
  async create(memory: Omit<Memory, 'id' | 'createdAt' | 'updatedAt' | 'lastAccessed'>): Promise<Memory> {
    const id = await db.memories.add({
      ...memory,
      id: undefined as any, // Dexie 会自动生成
      createdAt: undefined as any, // Hook 会处理
      updatedAt: undefined as any, // Hook 会处理
      lastAccessed: undefined as any, // Hook 会处理
    })

    return await this.getById(id as string) as Memory
  }

  /**
   * 根据 ID 获取记忆
   */
  async getById(id: string): Promise<Memory | null> {
    const memory = await db.memories.get(id)
    if (memory) {
      // 更新最后访问时间
      await this.updateLastAccessed(id)
    }
    return memory || null
  }

  /**
   * 获取所有记忆
   */
  async getAll(): Promise<Memory[]> {
    const memories = await db.memories.toArray()
    // 手动排序，按重要性降序
    memories.sort((a, b) => b.importance - a.importance)
    return memories
  }

  /**
   * 根据类型获取记忆
   */
  async getByType(type: Memory['type']): Promise<Memory[]> {
    const memories = await db.memories
      .where('type')
      .equals(type)
      .toArray()

    // 手动排序，按重要性降序
    memories.sort((a, b) => b.importance - a.importance)
    return memories
  }

  /**
   * 搜索记忆
   */
  async search(query: string, limit: number = 10): Promise<MemorySearchResult[]> {
    const lowerQuery = query.toLowerCase()
    const queryWords = lowerQuery.split(/\s+/).filter(word => word.length > 0)

    const memories = await db.memories.toArray()
    const results: MemorySearchResult[] = []

    for (const memory of memories) {
      let relevanceScore = 0

      // 内容匹配
      if (memory.content.toLowerCase().includes(lowerQuery)) {
        relevanceScore += 10
      }

      // 关键词匹配
      for (const keyword of memory.keywords) {
        if (keyword.toLowerCase().includes(lowerQuery)) {
          relevanceScore += 8
        }

        // 单词匹配
        for (const word of queryWords) {
          if (keyword.toLowerCase().includes(word)) {
            relevanceScore += 3
          }
        }
      }

      // 内容中的单词匹配
      for (const word of queryWords) {
        if (memory.content.toLowerCase().includes(word)) {
          relevanceScore += 2
        }
      }

      // 重要性加权
      relevanceScore *= (memory.importance / 10)

      if (relevanceScore > 0) {
        results.push({
          memory,
          relevanceScore,
        })

        // 更新最后访问时间
        await this.updateLastAccessed(memory.id)
      }
    }

    // 按相关性排序并限制数量
    return results
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit)
  }

  /**
   * 获取最近的记忆
   */
  async getRecent(limit: number = 20): Promise<Memory[]> {
    const memories = await db.memories.toArray()
    // 手动排序并限制数量
    memories.sort((a, b) => b.updatedAt - a.updatedAt)
    return memories.slice(0, limit)
  }

  /**
   * 根据重要性获取记忆
   */
  async getByImportance(minImportance: number = 7, limit?: number): Promise<Memory[]> {
    const memories = await db.memories
      .where('importance')
      .aboveOrEqual(minImportance)
      .toArray()

    // 手动排序
    memories.sort((a, b) => b.importance - a.importance)

    if (limit) {
      return memories.slice(0, limit)
    }

    return memories
  }

  /**
   * 根据关键词获取记忆
   */
  async getByKeywords(keywords: string[]): Promise<Memory[]> {
    if (keywords.length === 0) {
      return []
    }

    const memories = await db.memories
      .where('keywords')
      .anyOf(keywords)
      .toArray()

    // 手动排序
    memories.sort((a, b) => b.importance - a.importance)
    return memories
  }

  /**
   * 更新记忆
   */
  async update(id: string, updates: Partial<Omit<Memory, 'id' | 'createdAt'>>): Promise<Memory | null> {
    await db.memories.update(id, updates)
    return await this.getById(id)
  }

  /**
   * 更新最后访问时间
   */
  async updateLastAccessed(id: string): Promise<void> {
    await db.memories.update(id, {
      lastAccessed: Date.now(),
    })
  }

  /**
   * 删除记忆
   */
  async delete(id: string): Promise<boolean> {
    const count = await db.memories.where('id').equals(id).delete()
    return count > 0
  }

  /**
   * 批量删除记忆
   */
  async deleteMany(ids: string[]): Promise<number> {
    return await db.memories.where('id').anyOf(ids).delete()
  }

  /**
   * 根据消息ID获取相关记忆
   */
  async getByMessageIds(messageIds: string[]): Promise<Memory[]> {
    if (messageIds.length === 0) {
      return []
    }

    return await db.memories
      .filter(memory =>
        memory.relatedMessageIds.some(id => messageIds.includes(id)),
      )
      .toArray()
  }

  /**
   * 清理旧记忆（基于访问时间和重要性）
   */
  async cleanupOldMemories(daysOld: number = 30, minImportance: number = 5): Promise<number> {
    const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000)

    const memoriesToDelete = await db.memories
      .where('lastAccessed')
      .below(cutoffTime)
      .and(memory => memory.importance < minImportance)
      .toArray()

    const idsToDelete = memoriesToDelete.map(m => m.id)
    return await this.deleteMany(idsToDelete)
  }

  /**
   * 获取记忆统计
   */
  async getStats(): Promise<{
    total: number
    byType: Record<Memory['type'], number>
    byImportance: Record<number, number>
    averageImportance: number
  }> {
    const memories = await this.getAll()
    const stats = {
      total: memories.length,
      byType: {} as Record<Memory['type'], number>,
      byImportance: {} as Record<number, number>,
      averageImportance: 0,
    }

    // 按类型统计
    const types: Memory['type'][] = ['fact', 'preference', 'conversation', 'event']
    for (const type of types) {
      stats.byType[type] = memories.filter(m => m.type === type).length
    }

    // 按重要性统计
    for (let i = 1; i <= 10; i++) {
      stats.byImportance[i] = memories.filter(m => m.importance === i).length
    }

    // 平均重要性
    if (memories.length > 0) {
      stats.averageImportance = memories.reduce((sum, m) => sum + m.importance, 0) / memories.length
    }

    return stats
  }

  /**
   * 智能记忆推荐（基于关键词相似度）
   */
  async getRecommendations(sourceMemoryId: string, limit: number = 5): Promise<Memory[]> {
    const sourceMemory = await db.memories.get(sourceMemoryId)
    if (!sourceMemory) {
      return []
    }

    const allMemories = await db.memories
      .where('id')
      .notEqual(sourceMemoryId)
      .toArray()

    const recommendations = allMemories
      .map((memory) => {
        // 计算关键词重叠度
        const commonKeywords = memory.keywords.filter(k =>
          sourceMemory.keywords.includes(k),
        ).length

        const totalKeywords = new Set([...memory.keywords, ...sourceMemory.keywords]).size
        const similarity = totalKeywords > 0 ? commonKeywords / totalKeywords : 0

        return {
          memory,
          similarity: similarity * memory.importance, // 重要性加权
        }
      })
      .filter(item => item.similarity > 0)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map(item => item.memory)

    return recommendations
  }

  /**
   * 批量添加记忆
   */
  async bulkCreate(memories: Omit<Memory, 'id' | 'createdAt' | 'updatedAt' | 'lastAccessed'>[]): Promise<string[]> {
    const ids = await db.memories.bulkAdd(
      memories.map(memory => ({
        ...memory,
        id: undefined as any,
        createdAt: undefined as any,
        updatedAt: undefined as any,
        lastAccessed: undefined as any,
      })),
      { allKeys: true },
    )
    return ids as string[]
  }

  /**
   * 导出记忆数据
   */
  async exportAll(): Promise<Omit<Memory, 'id'>[]> {
    const memories = await this.getAll()
    return memories.map(({ id, ...exportData }) => exportData)
  }

  /**
   * 批量操作：事务中执行多个操作
   */
  async batchOperation<T>(
    operations: (transaction: typeof db.memories) => Promise<T>,
  ): Promise<T> {
    return await db.transaction('rw', db.memories, async () => {
      return await operations(db.memories)
    })
  }
}
