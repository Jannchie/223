/**
 * 记忆库服务
 * 负责管理长期记忆、上下文检索和记忆相关性分析
 */

import type { Memory, MemoryService, MemorySearchResult, ExtendedMessage } from '../types/chat'

const STORAGE_KEY = 'chat-memories'
const MAX_MEMORIES = 1000 // 最大记忆条数
const CLEANUP_THRESHOLD = 1200 // 清理阈值

class MemoryServiceImpl implements MemoryService {
  private memories: Map<string, Memory> = new Map()

  constructor() {
    this.loadFromStorage()
  }

  private generateId(): string {
    return Date.now().toString() + Math.random().toString(36).substring(2)
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const memoriesArray: Memory[] = JSON.parse(stored)
        this.memories.clear()
        memoriesArray.forEach(memory => {
          this.memories.set(memory.id, memory)
        })
      }
    } catch (error) {
      console.error('加载记忆数据失败:', error)
    }
  }

  private saveToStorage(): void {
    try {
      const memoriesArray = Array.from(this.memories.values())
      localStorage.setItem(STORAGE_KEY, JSON.stringify(memoriesArray))
    } catch (error) {
      console.error('保存记忆数据失败:', error)
    }
  }

  private cleanupOldMemories(): void {
    if (this.memories.size <= MAX_MEMORIES) {
      return
    }

    // 获取所有记忆并按重要性和最后访问时间排序
    const memoriesArray = Array.from(this.memories.values())
    memoriesArray.sort((a, b) => {
      // 首先按重要性排序（高到低）
      if (a.importance !== b.importance) {
        return b.importance - a.importance
      }
      // 然后按最后访问时间排序（新到旧）
      return b.lastAccessed - a.lastAccessed
    })

    // 保留前 MAX_MEMORIES 个记忆
    const toKeep = memoriesArray.slice(0, MAX_MEMORIES)
    this.memories.clear()
    toKeep.forEach(memory => {
      this.memories.set(memory.id, memory)
    })

    console.log(`记忆清理完成，保留了 ${toKeep.length} 条记忆`)
  }

  addMemory(memory: Omit<Memory, 'id' | 'createdAt' | 'updatedAt'>): Memory {
    const id = this.generateId()
    const now = Date.now()
    
    const newMemory: Memory = {
      ...memory,
      id,
      createdAt: now,
      updatedAt: now,
      lastAccessed: now
    }

    this.memories.set(id, newMemory)
    
    // 检查是否需要清理
    if (this.memories.size > CLEANUP_THRESHOLD) {
      this.cleanupOldMemories()
    }
    
    this.saveToStorage()
    return newMemory
  }

  searchMemories(query: string, limit: number = 10): MemorySearchResult[] {
    if (!query.trim()) {
      return []
    }

    const queryLower = query.toLowerCase()
    const queryKeywords = this.extractKeywords(query)
    const results: MemorySearchResult[] = []

    for (const memory of this.memories.values()) {
      const relevanceScore = this.calculateRelevance(memory, queryLower, queryKeywords)
      
      if (relevanceScore > 0) {
        results.push({
          memory,
          relevanceScore
        })
        
        // 更新最后访问时间
        memory.lastAccessed = Date.now()
      }
    }

    // 按相关性评分排序并限制结果数量
    results.sort((a, b) => b.relevanceScore - a.relevanceScore)
    const limitedResults = results.slice(0, limit)
    
    if (limitedResults.length > 0) {
      this.saveToStorage() // 保存更新的访问时间
    }
    
    return limitedResults
  }

  getRecentMemories(limit: number = 20): Memory[] {
    const memoriesArray = Array.from(this.memories.values())
    return memoriesArray
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit)
      .map(memory => {
        // 更新最后访问时间
        memory.lastAccessed = Date.now()
        return memory
      })
  }

  updateMemory(id: string, updates: Partial<Memory>): Memory {
    const existing = this.memories.get(id)
    if (!existing) {
      throw new Error(`记忆 ${id} 不存在`)
    }

    const updated: Memory = {
      ...existing,
      ...updates,
      id: existing.id, // 确保 ID 不会被覆盖
      createdAt: existing.createdAt,
      updatedAt: Date.now()
    }

    this.memories.set(id, updated)
    this.saveToStorage()
    
    return updated
  }

  deleteMemory(id: string): boolean {
    if (!this.memories.has(id)) {
      return false
    }

    this.memories.delete(id)
    this.saveToStorage()
    return true
  }

  getMemoriesByType(type: Memory['type']): Memory[] {
    return Array.from(this.memories.values())
      .filter(memory => memory.type === type)
      .sort((a, b) => b.createdAt - a.createdAt)
  }

  extractMemoriesFromMessage(message: ExtendedMessage): Omit<Memory, 'id' | 'createdAt' | 'updatedAt'>[] {
    const memories: Omit<Memory, 'id' | 'createdAt' | 'updatedAt'>[] = []
    
    // 提取事实性信息
    const facts = this.extractFacts(message.content)
    facts.forEach(fact => {
      memories.push({
        ...this.createBaseMemory('fact', fact, message),
        importance: 6 // 中等重要性
      })
    })

    // 提取偏好信息
    const preferences = this.extractPreferences(message.content)
    preferences.forEach(preference => {
      memories.push({
        ...this.createBaseMemory('preference', preference, message),
        importance: 7 // 较高重要性
      })
    })

    // 提取重要事件
    if (this.isImportantEvent(message.content)) {
      memories.push({
        ...this.createBaseMemory('event', `用户分享了重要事件：${message.content}`, message),
        importance: 8 // 高重要性
      })
    }

    // 保存对话片段（较低优先级）
    if (message.role === 'user' && message.content.length > 20) {
      memories.push({
        ...this.createBaseMemory('conversation', message.content, message),
        importance: 4 // 较低重要性
      })
    }

    return memories
  }

  private createBaseMemory(type: Memory['type'], content: string, message: ExtendedMessage): Omit<Memory, 'id' | 'createdAt' | 'updatedAt'> {
    return {
      type,
      content,
      keywords: this.extractKeywords(content),
      importance: 5, // 默认重要性
      lastAccessed: Date.now(),
      relatedMessageIds: [message.id]
    }
  }

  private extractKeywords(text: string): string[] {
    const keywords = new Set<string>()
    const words = text.toLowerCase().match(/[\u4e00-\u9fa5\w]+/g) || []
    
    // 过滤常见停用词和短词
    const stopWords = new Set(['的', '是', '在', '了', '和', '有', '我', '你', '他', '她', '它', 'the', 'is', 'are', 'was', 'were', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'])
    
    words.forEach(word => {
      if (word.length > 1 && !stopWords.has(word)) {
        keywords.add(word)
      }
    })

    return Array.from(keywords)
  }

  private calculateRelevance(memory: Memory, queryLower: string, queryKeywords: string[]): number {
    let score = 0

    // 内容直接匹配
    if (memory.content.toLowerCase().includes(queryLower)) {
      score += 10
    }

    // 关键词匹配
    const matchingKeywords = memory.keywords.filter(keyword => 
      queryKeywords.some(qk => keyword.includes(qk) || qk.includes(keyword))
    )
    score += matchingKeywords.length * 2

    // 重要性加权
    score += memory.importance * 0.5

    // 时间衰减（越新的记忆分数越高）
    const daysSinceCreated = (Date.now() - memory.createdAt) / (1000 * 60 * 60 * 24)
    const timeDecay = Math.max(0, 1 - daysSinceCreated / 30) // 30天后开始显著衰减
    score *= (0.5 + timeDecay * 0.5)

    return score
  }

  private extractFacts(content: string): string[] {
    const facts: string[] = []
    
    // 简单的事实提取模式
    const factPatterns = [
      /我(?:喜欢|爱|不喜欢|讨厌)(.+)/g,
      /我(?:是|叫|名字是)(.+)/g,
      /我(?:在|住在|来自)(.+)/g,
      /我(?:学|学习|专业是)(.+)/g,
      /我(?:工作|做|职业是)(.+)/g
    ]

    factPatterns.forEach(pattern => {
      let match
      while ((match = pattern.exec(content)) !== null) {
        facts.push(match[0])
      }
    })

    return facts
  }

  private extractPreferences(content: string): string[] {
    const preferences: string[] = []
    
    // 偏好提取模式
    const preferencePatterns = [
      /(?:更喜欢|偏爱|偏好)(.+)/g,
      /(?:不喜欢|讨厌|不要)(.+)/g,
      /(?:希望|想要|期望)(.+)/g
    ]

    preferencePatterns.forEach(pattern => {
      let match
      while ((match = pattern.exec(content)) !== null) {
        preferences.push(match[0])
      }
    })

    return preferences
  }

  private isImportantEvent(content: string): boolean {
    const eventKeywords = [
      '生日', '结婚', '毕业', '工作', '旅行', '搬家', '考试', 
      '面试', '升职', '生病', '康复', '成功', '失败', '获奖',
      '发布', '完成', '开始', '结束'
    ]
    
    return eventKeywords.some(keyword => content.includes(keyword))
  }

  // 辅助方法：获取记忆统计信息
  getMemoryStats(): {
    total: number
    byType: Record<Memory['type'], number>
    avgImportance: number
    oldestMemory: number | null
    newestMemory: number | null
  } {
    const memoriesArray = Array.from(this.memories.values())
    
    const byType = {
      fact: 0,
      preference: 0,
      conversation: 0,
      event: 0
    }

    let totalImportance = 0
    let oldest: number | null = null
    let newest: number | null = null

    memoriesArray.forEach(memory => {
      byType[memory.type]++
      totalImportance += memory.importance
      
      if (oldest === null || memory.createdAt < oldest) {
        oldest = memory.createdAt
      }
      if (newest === null || memory.createdAt > newest) {
        newest = memory.createdAt
      }
    })

    return {
      total: memoriesArray.length,
      byType,
      avgImportance: memoriesArray.length > 0 ? totalImportance / memoriesArray.length : 0,
      oldestMemory: oldest,
      newestMemory: newest
    }
  }

  // 辅助方法：清空所有记忆
  clearAllMemories(): void {
    this.memories.clear()
    this.saveToStorage()
  }

  // 辅助方法：导出记忆数据
  exportMemories(): string {
    const memoriesArray = Array.from(this.memories.values())
    return JSON.stringify(memoriesArray, null, 2)
  }

  // 辅助方法：导入记忆数据
  importMemories(memoriesData: string, merge: boolean = false): void {
    try {
      const importedMemories: Memory[] = JSON.parse(memoriesData)
      
      if (!merge) {
        this.memories.clear()
      }
      
      importedMemories.forEach(memory => {
        // 验证记忆数据结构
        if (memory.id && memory.content && memory.type) {
          this.memories.set(memory.id, memory)
        }
      })
      
      this.saveToStorage()
    } catch (error) {
      throw new Error(`导入记忆失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }
}

// 创建单例实例
export const memoryService = new MemoryServiceImpl()

export { type Memory, type MemorySearchResult }