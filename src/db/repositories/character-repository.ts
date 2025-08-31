/**
 * 角色数据访问仓库
 * 提供角色相关的数据库操作
 */

import type { Character } from '../../types/chat'
import { db } from '../index'

export class CharacterRepository {
  /**
   * 创建新角色
   */
  async create(character: Omit<Character, 'id' | 'createdAt' | 'updatedAt'>): Promise<Character> {
    const id = await db.characters.add({
      ...character,
      id: undefined as any, // Dexie 会自动生成
      createdAt: undefined as any, // Hook 会处理
      updatedAt: undefined as any, // Hook 会处理
    })

    return await this.getById(id as string) as Character
  }

  /**
   * 根据 ID 获取角色
   */
  async getById(id: string): Promise<Character | null> {
    const character = await db.characters.get(id)
    return character || null
  }

  /**
   * 获取所有角色
   */
  async getAll(): Promise<Character[]> {
    return await db.characters.orderBy('updatedAt').reverse().toArray()
  }

  /**
   * 更新角色
   */
  async update(id: string, updates: Partial<Omit<Character, 'id' | 'createdAt'>>): Promise<Character | null> {
    await db.characters.update(id, updates)
    return await this.getById(id)
  }

  /**
   * 删除角色
   */
  async delete(id: string): Promise<boolean> {
    const count = await db.characters.where('id').equals(id).delete()
    return count > 0
  }

  /**
   * 搜索角色（根据名称和描述）
   */
  async search(query: string): Promise<Character[]> {
    const lowerQuery = query.toLowerCase()
    return await db.characters
      .filter(character =>
        character.name.toLowerCase().includes(lowerQuery)
        || character.description?.toLowerCase().includes(lowerQuery)
        || character.systemPrompt.toLowerCase().includes(lowerQuery),
      )
      .toArray()
  }

  /**
   * 根据名称查找角色
   */
  async getByName(name: string): Promise<Character | null> {
    const character = await db.characters
      .filter(character => character.name === name)
      .first()

    return character || null
  }

  /**
   * 检查角色名称是否存在
   */
  async nameExists(name: string, excludeId?: string): Promise<boolean> {
    const character = await db.characters
      .filter(character =>
        character.name === name
        && (excludeId ? character.id !== excludeId : true),
      )
      .first()

    return !!character
  }

  /**
   * 获取最近创建的角色
   */
  async getRecentlyCreated(limit: number = 10): Promise<Character[]> {
    return await db.characters
      .orderBy('createdAt')

      .reverse()
      .limit(limit)
      .toArray()
  }

  /**
   * 获取最近更新的角色
   */
  async getRecentlyUpdated(limit: number = 10): Promise<Character[]> {
    return await db.characters
      .orderBy('updatedAt')
      .reverse()
      .limit(limit)
      .toArray()
  }

  /**
   * 根据特征搜索角色（基于系统提示词内容）
   */
  async searchByTraits(traits: string[]): Promise<Character[]> {
    if (traits.length === 0) {
      return []
    }

    return await db.characters
      .filter((character) => {
        const systemPrompt = character.systemPrompt.toLowerCase()
        return traits.some(trait =>
          systemPrompt.includes(trait.toLowerCase()),
        )
      })
      .toArray()
  }

  /**
   * 获取角色数量
   */
  async count(): Promise<number> {
    return await db.characters.count()
  }

  /**
   * 批量创建角色
   */
  async bulkCreate(characters: Omit<Character, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<string[]> {
    const ids = await db.characters.bulkAdd(
      characters.map(char => ({
        ...char,
        id: undefined as any,
        createdAt: undefined as any,
        updatedAt: undefined as any,
      })),
      { allKeys: true },
    )
    return ids as string[]
  }

  /**
   * 导出角色数据
   */
  async exportCharacter(id: string): Promise<Omit<Character, 'id' | 'createdAt' | 'updatedAt'> | null> {
    const character = await this.getById(id)
    if (!character) {
      return null
    }

    const { id: _, createdAt, updatedAt, ...exportData } = character
    return exportData
  }

  /**
   * 导出所有角色
   */
  async exportAll(): Promise<Omit<Character, 'id' | 'createdAt' | 'updatedAt'>[]> {
    const characters = await this.getAll()
    return characters.map(({ id, createdAt, updatedAt, ...exportData }) => exportData)
  }

  /**
   * 克隆角色
   */
  async clone(id: string, newName?: string): Promise<Character | null> {
    const original = await this.getById(id)
    if (!original) {
      return null
    }

    const { id: _, createdAt, updatedAt, name, ...cloneData } = original

    return await this.create({
      ...cloneData,
      name: newName || `${name} - 副本`,
    })
  }

  /**
   * 统计角色使用情况（需要配合会话表）
   */
  async getUsageStats(): Promise<Array<{
    character: Character
    sessionCount: number
    lastUsed?: number
  }>> {
    const characters = await this.getAll()
    const stats = []

    for (const character of characters) {
      const sessions = await db.sessions.where('characterId').equals(character.id).toArray()
      const lastUsed = sessions.length > 0
        ? Math.max(...sessions.map(s => s.updatedAt))
        : undefined

      stats.push({
        character,
        sessionCount: sessions.length,
        lastUsed,
      })
    }

    return stats.sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0))
  }

  /**
   * 批量操作：事务中执行多个操作
   */
  async batchOperation<T>(
    operations: (transaction: typeof db.characters) => Promise<T>,
  ): Promise<T> {
    return await db.transaction('rw', db.characters, async () => {
      return await operations(db.characters)
    })
  }
}
