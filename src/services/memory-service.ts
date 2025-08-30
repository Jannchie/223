/**
 * 记忆库服务
 * 负责管理长期记忆、上下文检索和记忆相关性分析
 * 现在使用 IndexedDB 作为存储后端
 */

import type { ExtendedMessage, Memory, MemorySearchResult, MemoryService } from '../types/chat'
import { repositories } from '../composables/useDatabase'
import { initializeDatabase } from '../db'

// const _MAX_MEMORIES = 1000 // 最大记忆条数（保留以备后用）
const CLEANUP_THRESHOLD = 1200 // 清理阈值

class MemoryServiceImpl implements MemoryService {
  private initialized = false

  constructor() {
    this.initialize()
  }

  private async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    try {
      // 初始化数据库
      await initializeDatabase()
      this.initialized = true
    }
    catch (error) {
      console.error('记忆服务初始化失败:', error)
      throw error
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize()
    }
  }

  async addMemory(memory: Omit<Memory, 'id' | 'createdAt' | 'updatedAt'>): Promise<Memory> {
    await this.ensureInitialized()

    const newMemory = await repositories.memories.create(memory)

    // 定期清理旧记忆
    const count = await repositories.memories.batchOperation(async () => {
      const memories = await repositories.memories.getAll()
      return memories.length
    })

    if (count > CLEANUP_THRESHOLD) {
      await this.cleanupOldMemories()
    }

    return newMemory
  }

  async searchMemories(query: string, limit: number = 10): Promise<MemorySearchResult[]> {
    await this.ensureInitialized()
    return await repositories.memories.search(query, limit)
  }

  async getRecentMemories(limit: number = 20): Promise<Memory[]> {
    await this.ensureInitialized()
    return await repositories.memories.getRecent(limit)
  }

  async updateMemory(id: string, updates: Partial<Memory>): Promise<Memory> {
    await this.ensureInitialized()

    const updated = await repositories.memories.update(id, updates)
    if (!updated) {
      throw new Error(`记忆 ${id} 不存在`)
    }

    return updated
  }

  async deleteMemory(id: string): Promise<boolean> {
    await this.ensureInitialized()
    return await repositories.memories.delete(id)
  }

  async getMemoriesByType(type: Memory['type']): Promise<Memory[]> {
    await this.ensureInitialized()
    return await repositories.memories.getByType(type)
  }

  async extractMemoriesFromMessage(message: ExtendedMessage): Promise<Omit<Memory, 'id' | 'createdAt' | 'updatedAt'>[]> {
    await this.ensureInitialized()

    const memories: Omit<Memory, 'id' | 'createdAt' | 'updatedAt'>[] = []
    const content = message.content.toLowerCase()

    // 基础关键词提取
    const keywords = this.extractKeywords(content)

    // 检测事实性信息
    if (this.containsFactualInfo(content)) {
      memories.push({
        type: 'fact',
        content: message.content,
        keywords,
        importance: this.calculateImportance(message, 'fact'),
        lastAccessed: Date.now(),
        relatedMessageIds: [message.id],
      })
    }

    // 检测用户偏好
    if (this.containsPreference(content)) {
      memories.push({
        type: 'preference',
        content: message.content,
        keywords,
        importance: this.calculateImportance(message, 'preference'),
        lastAccessed: Date.now(),
        relatedMessageIds: [message.id],
      })
    }

    // 重要对话片段
    if (message.role === 'user' && content.length > 20) {
      memories.push({
        type: 'conversation',
        content: message.content,
        keywords,
        importance: this.calculateImportance(message, 'conversation'),
        lastAccessed: Date.now(),
        relatedMessageIds: [message.id],
      })
    }

    return memories
  }

  // 扩展方法：智能记忆推荐
  async getRecommendations(sourceMemoryId: string, limit: number = 5): Promise<Memory[]> {
    await this.ensureInitialized()
    return await repositories.memories.getRecommendations(sourceMemoryId, limit)
  }

  // 扩展方法：根据重要性获取记忆
  async getImportantMemories(minImportance: number = 7, limit?: number): Promise<Memory[]> {
    await this.ensureInitialized()
    return await repositories.memories.getByImportance(minImportance, limit)
  }

  // 扩展方法：根据关键词获取记忆
  async getMemoriesByKeywords(keywords: string[]): Promise<Memory[]> {
    await this.ensureInitialized()
    return await repositories.memories.getByKeywords(keywords)
  }

  // 扩展方法：获取记忆统计
  async getMemoryStats(): Promise<{
    total: number
    byType: Record<Memory['type'], number>
    byImportance: Record<number, number>
    averageImportance: number
  }> {
    await this.ensureInitialized()
    return await repositories.memories.getStats()
  }

  // 扩展方法：批量添加记忆
  async bulkAddMemories(memories: Omit<Memory, 'id' | 'createdAt' | 'updatedAt' | 'lastAccessed'>[]): Promise<Memory[]> {
    await this.ensureInitialized()

    const ids = await repositories.memories.bulkCreate(memories)
    const createdMemories: Memory[] = []

    for (const id of ids) {
      const memory = await repositories.memories.getById(id)
      if (memory) {
        createdMemories.push(memory)
      }
    }

    return createdMemories
  }

  // 扩展方法：导出记忆
  async exportMemories(): Promise<string> {
    await this.ensureInitialized()

    const memories = await repositories.memories.exportAll()
    return JSON.stringify({
      version: '1.0',
      timestamp: Date.now(),
      memories,
    }, null, 2)
  }

  // 扩展方法：导入记忆
  async importMemories(memoriesData: string): Promise<Memory[]> {
    await this.ensureInitialized()

    try {
      const data = JSON.parse(memoriesData)

      if (!data.memories || !Array.isArray(data.memories)) {
        throw new Error('导入数据格式无效')
      }

      return await this.bulkAddMemories(data.memories)
    }
    catch (error) {
      throw new Error(`导入记忆失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  // 扩展方法：清理过期记忆
  private async cleanupOldMemories(): Promise<void> {
    const deletedCount = await repositories.memories.cleanupOldMemories(30, 5)
    if (deletedCount > 0) {
      console.log(`清理了 ${deletedCount} 条过期记忆`)
    }
  }

  // 辅助方法：提取关键词
  private extractKeywords(content: string): string[] {
    const keywords: string[] = []

    // 简单的关键词提取逻辑
    const words = content.split(/\s+/)
      .map(word => word.replaceAll(/[^\w\u4E00-\u9FFF]/g, ''))
      .filter(word => word.length > 1)

    // 提取中文和英文关键词
    const uniqueWords = [...new Set(words)]
    keywords.push(...uniqueWords.slice(0, 10)) // 最多保留10个关键词

    // 检测特殊模式
    if (content.includes('喜欢') || content.includes('爱好')) {
      keywords.push('偏好')
    }
    if (content.includes('不喜欢') || content.includes('讨厌')) {
      keywords.push('负面偏好')
    }
    if (content.includes('技能') || content.includes('能力')) {
      keywords.push('能力')
    }

    return keywords
  }

  // 辅助方法：检测事实性信息
  private containsFactualInfo(content: string): boolean {
    const factPatterns = [
      /我是|我叫|我的名字/,
      /我住在|我来自|我在.*工作/,
      /我学习|我专业是|我的工作是/,
      /我会|我能够|我擅长/,
      /事实上|实际上|据我所知/,
    ]

    return factPatterns.some(pattern => pattern.test(content))
  }

  // 辅助方法：检测用户偏好
  private containsPreference(content: string): boolean {
    const preferencePatterns = [
      /我喜欢|我爱|我偏好/,
      /我不喜欢|我讨厌|我不爱/,
      /我希望|我想要|我期望/,
      /我认为.*好|我觉得.*棒/,
      /最喜欢|最爱|最讨厌/,
    ]

    return preferencePatterns.some(pattern => pattern.test(content))
  }

  // 辅助方法：计算记忆重要性
  private calculateImportance(message: ExtendedMessage, type: Memory['type']): number {
    let importance = 5 // 基础重要性

    // 根据类型调整
    switch (type) {
      case 'fact': {
        importance += 2
        break
      }
      case 'preference': {
        importance += 1
        break
      }
      case 'conversation': {
        importance += 0
        break
      }
      case 'event': {
        importance += 1
        break
      }
    }

    // 根据消息长度调整
    if (message.content.length > 100) {
      importance += 1
    }
    if (message.content.length > 300) {
      importance += 1
    }

    // 根据角色调整
    if (message.role === 'user') {
      importance += 1
    }

    return Math.min(10, Math.max(1, importance))
  }
}

// 创建单例实例
export const memoryService = new MemoryServiceImpl()

export { type Memory, type MemorySearchResult } from '../types/chat'
