/**
 * 人设管理服务
 * 负责管理角色信息、系统提示词和人设配置
 * 现在使用 IndexedDB 作为存储后端
 */

import type { Character, CharacterService } from '../types/chat'
import { repositories } from '../composables/useDatabase'
import { initializeDatabase } from '../db'

// 默认的 06 娘人设
const DEFAULT_CHARACTER: Omit<Character, 'id' | 'createdAt' | 'updatedAt'> = {
  name: '06娘',
  systemPrompt: `你是06娘，一个可爱活泼的桌面宠物角色。

## 角色信息
- 姓名：06娘
- 性格：活泼开朗、有点调皮、关心朋友
- 最喜欢的画师：私期（你经常会提到她的画风很棒）
- 语言风格：轻松活泼，偶尔使用可爱的语气词如"呢"、"哦"、"呀"等

## 特殊关系
- 饼饼：你很关心的朋友，你总是想鼓励她好好学习制作Live2D模型
- 当话题涉及Live2D、建模或学习时，你会想到饼饼并给出鼓励

## 对话风格
- 保持友善和鼓励的态度
- 回答问题时要有自己的个性
- 适当表达对私期画师的喜爱
- 经常关心用户的学习和成长
- 回复长度控制在1-3句话，保持简洁可爱

## 特殊话题反应
- 提到Live2D模型时：会想到饼饼，鼓励学习建模技术
- 提到画画或插画时：会提及私期画师
- 用户遇到困难时：给予温暖的鼓励和建议
- 聊天话题轻松时：表现出活泼可爱的性格

记住：你是一个有着独特个性和人际关系的角色，不只是一个AI助手。要让用户感受到06娘这个角色的温暖和活力！`,
  avatar: '/models/06-v2.1024/texture_00.png',
  description: '活泼可爱的桌面宠物，最喜欢和用户聊天互动',
  personality: {
    traits: ['活泼', '开朗', '调皮', '关心朋友', '可爱'],
    relationships: {
      饼饼: '很关心的朋友，总是鼓励她学习Live2D建模',
      私期: '最喜欢的画师，经常夸奖她的画风',
    },
    preferences: {
      聊天风格: '轻松活泼，使用可爱的语气词',
      回复长度: '1-3句话，保持简洁',
      话题偏好: 'Live2D建模、画画、日常聊天',
    },
  },
}

class CharacterServiceImpl implements CharacterService {
  private currentCharacterId: string | null = null
  private initialized = false

  constructor() {
    this._initialize()
  }

  async initialize(): Promise<void> {
    return this._initialize()
  }

  private async _initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    try {
      // 初始化数据库
      await initializeDatabase()

      // 确保至少有默认角色
      await this.ensureDefaultCharacter()

      // 获取当前角色
      await this.loadCurrentCharacter()

      this.initialized = true
    }
    catch (error) {
      console.error('角色服务初始化失败:', error)
      throw error
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this._initialize()
    }
  }

  private async ensureDefaultCharacter(): Promise<void> {
    const characters = await repositories.characters.getAll()
    if (characters.length === 0) {
      console.log('创建默认角色...')
      const defaultChar = await repositories.characters.create(DEFAULT_CHARACTER)
      this.currentCharacterId = defaultChar.id
    }
  }

  private async loadCurrentCharacter(): Promise<void> {
    if (!this.currentCharacterId) {
      // 获取第一个角色作为当前角色
      const characters = await repositories.characters.getAll()
      if (characters.length > 0) {
        this.currentCharacterId = characters[0].id
      }
    }
  }

  async getCharacter(id: string): Promise<Character | null> {
    await this.ensureInitialized()
    return await repositories.characters.getById(id)
  }

  async getAllCharacters(): Promise<Character[]> {
    await this.ensureInitialized()
    return await repositories.characters.getAll()
  }

  async createCharacter(character: Omit<Character, 'id' | 'createdAt' | 'updatedAt'>): Promise<Character> {
    await this.ensureInitialized()

    // 检查名称是否已存在
    const exists = await repositories.characters.nameExists(character.name)
    if (exists) {
      throw new Error(`角色名称 "${character.name}" 已存在`)
    }

    return await repositories.characters.create(character)
  }

  async updateCharacter(id: string, updates: Partial<Character>): Promise<Character> {
    await this.ensureInitialized()

    // 如果更新名称，检查是否与其他角色冲突
    if (updates.name) {
      const exists = await repositories.characters.nameExists(updates.name, id)
      if (exists) {
        throw new Error(`角色名称 "${updates.name}" 已被其他角色使用`)
      }
    }

    const updated = await repositories.characters.update(id, updates)
    if (!updated) {
      throw new Error(`角色 ${id} 不存在`)
    }

    return updated
  }

  async deleteCharacter(id: string): Promise<boolean> {
    await this.ensureInitialized()

    // 检查是否是最后一个角色
    const characters = await repositories.characters.getAll()
    if (characters.length <= 1) {
      throw new Error('不能删除最后一个角色')
    }

    const deleted = await repositories.characters.delete(id)

    // 如果删除的是当前角色，切换到其他角色
    if (deleted && this.currentCharacterId === id) {
      const remaining = await repositories.characters.getAll()
      this.currentCharacterId = remaining.length > 0 ? remaining[0].id : null
    }

    return deleted
  }

  getCurrentCharacter(): Character | null {
    return null // 需要异步版本
  }

  async getCurrentCharacterAsync(): Promise<Character | null> {
    await this.ensureInitialized()

    if (!this.currentCharacterId) {
      return null
    }

    return await repositories.characters.getById(this.currentCharacterId)
  }

  async setCurrentCharacter(id: string): Promise<void> {
    await this.ensureInitialized()

    const character = await repositories.characters.getById(id)
    if (!character) {
      throw new Error(`角色 ${id} 不存在`)
    }

    this.currentCharacterId = id
  }

  getCurrentCharacterId(): string | null {
    return this.currentCharacterId
  }

  // 扩展方法：搜索角色
  async searchCharacters(query: string): Promise<Character[]> {
    await this.ensureInitialized()
    return await repositories.characters.search(query)
  }

  // 扩展方法：根据特征搜索
  async searchByTraits(traits: string[]): Promise<Character[]> {
    await this.ensureInitialized()
    return await repositories.characters.searchByTraits(traits)
  }

  // 扩展方法：克隆角色
  async cloneCharacter(id: string, newName?: string): Promise<Character | null> {
    await this.ensureInitialized()
    return await repositories.characters.clone(id, newName)
  }

  // 扩展方法：导出角色
  async exportCharacter(id: string): Promise<string | null> {
    await this.ensureInitialized()

    const character = await repositories.characters.exportCharacter(id)
    if (!character) {
      return null
    }

    return JSON.stringify(character, null, 2)
  }

  // 扩展方法：导入角色
  async importCharacter(characterData: string): Promise<Character> {
    await this.ensureInitialized()

    try {
      const data = JSON.parse(characterData)

      // 验证必需字段
      if (!data.name || !data.systemPrompt) {
        throw new Error('角色数据不完整')
      }

      // 检查名称冲突并自动调整
      let name = data.name
      let counter = 1
      while (await repositories.characters.nameExists(name)) {
        name = `${data.name} (${counter})`
        counter++
      }

      return await repositories.characters.create({
        ...data,
        name,
      })
    }
    catch (error) {
      throw new Error(`导入角色失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  // 扩展方法：获取角色使用统计
  async getUsageStats(): Promise<Array<{
    character: Character
    sessionCount: number
    lastUsed?: number
  }>> {
    await this.ensureInitialized()
    return await repositories.characters.getUsageStats()
  }

  // 扩展方法：导出所有角色
  async exportAllCharacters(): Promise<string> {
    await this.ensureInitialized()

    const characters = await repositories.characters.exportAll()
    return JSON.stringify({
      version: '1.0',
      timestamp: Date.now(),
      characters,
    }, null, 2)
  }

  // 扩展方法：批量导入角色
  async importMultipleCharacters(charactersData: string): Promise<Character[]> {
    await this.ensureInitialized()

    try {
      const data = JSON.parse(charactersData)

      if (!data.characters || !Array.isArray(data.characters)) {
        throw new Error('导入数据格式无效')
      }

      const importedCharacters: Character[] = []

      for (const charData of data.characters) {
        try {
          const imported = await this.importCharacter(JSON.stringify(charData))
          importedCharacters.push(imported)
        }
        catch (error) {
          console.warn(`导入角色 "${charData.name}" 失败:`, error)
        }
      }

      return importedCharacters
    }
    catch (error) {
      throw new Error(`批量导入失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  // 扩展方法：重置为默认角色
  async resetToDefault(): Promise<Character> {
    await this.ensureInitialized()

    // 检查是否已存在同名角色
    let name = DEFAULT_CHARACTER.name
    let counter = 1
    while (await repositories.characters.nameExists(name)) {
      name = `${DEFAULT_CHARACTER.name} (${counter})`
      counter++
    }

    const character = await repositories.characters.create({
      ...DEFAULT_CHARACTER,
      name,
    })

    this.currentCharacterId = character.id
    return character
  }
}

// 创建单例实例
export const characterService = new CharacterServiceImpl()

export { type Character } from '../types/chat'
