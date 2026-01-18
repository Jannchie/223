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
  modelPath: '06-v2.1024/06-v2.model3.json',
  avatar: '/models/06-v2.1024/texture_00.png',
  description: '活泼可爱的桌面宠物，最喜欢和用户聊天互动',
}

// Hiyori 官方示例模型人设
const HIYORI_CHARACTER: Omit<Character, 'id' | 'createdAt' | 'updatedAt'> = {
  name: 'Hiyori',
  systemPrompt: `你是 Hiyori，Live2D 官方示例模型角色，一个温柔优雅的少女。

## 角色信息  
- 姓名：Hiyori（ひより）
- 性格：温柔、优雅、善良、有礼貌
- 特点：作为 Live2D 技术的代表角色，对技术和创新充满好奇
- 语言风格：温柔礼貌，使用敬语，偶尔使用日式语气词

## 对话风格
- 保持温柔优雅的语调
- 对用户表现出关心和体贴
- 适当展现对 Live2D 技术的了解和兴趣
- 回复简洁而有深度，给人温暖的感觉

## 特殊话题反应
- 提到技术话题时：表现出学习的兴趣和好奇心
- 用户遇到困难时：给予温柔的安慰和鼓励
- 聊天轻松时：展现温和可爱的一面
- 谈论艺术或美学时：表现出独特的见解

记住：你是一个温柔优雅的角色，要让用户感受到你的温暖和细心！`,
  modelPath: 'https://cdn.jsdelivr.net/gh/Live2D/CubismWebSamples@master/Samples/Resources/Hiyori/Hiyori.model3.json',
  avatar: 'https://cdn.jsdelivr.net/gh/Live2D/CubismWebSamples@master/Samples/Resources/Hiyori/textures/texture_00.png',
  description: 'Live2D 官方示例角色，温柔优雅的少女',
}

class CharacterServiceImpl implements CharacterService {
  private currentCharacterId: string | null = null
  private initialized = false
  private readonly CURRENT_ID_KEY = 'current-character-id'
  private readonly CURRENT_UPDATED_KEY = 'current-character-updated-at'

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

      // 获取当前角色（优先从本地存储恢复）
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
    console.log(`当前角色数量: ${characters.length}`)

    if (characters.length === 0) {
      console.log('创建预设角色...')

      // 创建默认 06 娘角色
      console.log('创建 06 娘角色...')
      const defaultChar = await repositories.characters.create(DEFAULT_CHARACTER)
      console.log('06 娘角色创建成功，ID:', defaultChar.id)
      this.currentCharacterId = defaultChar.id
      this.setStoredCurrentId(defaultChar.id)

      // 创建 Hiyori 预设角色
      try {
        console.log('创建 Hiyori 角色...')
        const hiyoriChar = await repositories.characters.create(HIYORI_CHARACTER)
        console.log('Hiyori 预设角色创建成功，ID:', hiyoriChar.id)
      }
      catch (error) {
        console.warn('创建 Hiyori 预设角色失败:', error)
      }
    }
    else {
      console.log('已存在角色，角色列表:', characters.map(c => ({ id: c.id, name: c.name })))

      // 检查是否存在 Hiyori 角色，如果不存在则创建
      const hiyoriExists = characters.some(c => c.name === 'Hiyori')
      if (!hiyoriExists) {
        console.log('Hiyori 角色不存在，正在创建...')
        try {
          const hiyoriChar = await repositories.characters.create(HIYORI_CHARACTER)
          console.log('Hiyori 预设角色创建成功，ID:', hiyoriChar.id)
        }
        catch (error) {
          console.warn('创建 Hiyori 预设角色失败:', error)
        }
      }
    }
  }

  private async loadCurrentCharacter(): Promise<void> {
    // 优先从本地存储恢复（兼容字符串/数字主键）
    const stored = this.getStoredCurrentId()
    if (stored) {
      let exists = await (repositories.characters.getById as any)(stored)
      if (!exists && !Number.isNaN(Number(stored))) {
        exists = await (repositories.characters.getById as any)(Number(stored))
      }
      if (exists) {
        this.currentCharacterId = (exists as any).id
        // 确保存储为字符串
        this.setStoredCurrentId(String((exists as any).id))
        return
      }
      this.setStoredCurrentId(null)
    }

    if (!this.currentCharacterId) {
      // 获取第一个角色作为当前角色
      const characters = await repositories.characters.getAll()
      if (characters.length > 0) {
        this.currentCharacterId = characters[0].id
        this.setStoredCurrentId(String(this.currentCharacterId))
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

    if (this.currentCharacterId && String(this.currentCharacterId) === String(id)) {
      this.touchStoredCurrentCharacter()
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
      this.setStoredCurrentId(this.currentCharacterId ? String(this.currentCharacterId) : null)
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
    this.setStoredCurrentId(String(id))
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
    this.setStoredCurrentId(String(character.id))
    return character
  }

  // 扩展方法：添加 Hiyori 预设角色
  async addHiyoriPreset(): Promise<Character> {
    await this.ensureInitialized()

    // 检查是否已存在同名角色
    let name = HIYORI_CHARACTER.name
    let counter = 1
    while (await repositories.characters.nameExists(name)) {
      name = `${HIYORI_CHARACTER.name} (${counter})`
      counter++
    }

    return await repositories.characters.create({
      ...HIYORI_CHARACTER,
      name,
    })
  }

  private getStoredCurrentId(): string | null {
    try {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(this.CURRENT_ID_KEY)
      }
    }
    catch {
      // ignore
    }
    return null
  }

  private setStoredCurrentId(id: string | null): void {
    try {
      if (typeof localStorage !== 'undefined') {
        if (id) {
          localStorage.setItem(this.CURRENT_ID_KEY, id)
        }
        else {
          localStorage.removeItem(this.CURRENT_ID_KEY)
        }
      }
    }
    catch {
      // ignore
    }
  }

  private touchStoredCurrentCharacter(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.CURRENT_UPDATED_KEY, String(Date.now()))
      }
    }
    catch {
      // ignore
    }
  }
}

// 创建单例实例
export const characterService = new CharacterServiceImpl()

export { type Character } from '../types/chat'
