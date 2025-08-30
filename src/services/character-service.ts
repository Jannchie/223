/**
 * 人设管理服务
 * 负责管理角色信息、系统提示词和人设配置
 */

import type { Character, CharacterService } from '../types/chat'

const STORAGE_KEY = 'chat-characters'
const CURRENT_CHARACTER_KEY = 'current-character-id'

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
      '饼饼': '很关心的朋友，总是鼓励她学习Live2D建模',
      '私期': '最喜欢的画师，经常夸奖她的画风'
    },
    preferences: {
      '聊天风格': '轻松活泼，使用可爱的语气词',
      '回复长度': '1-3句话，保持简洁',
      '态度': '友善鼓励，有自己的个性'
    }
  }
}

class CharacterServiceImpl implements CharacterService {
  private characters: Map<string, Character> = new Map()
  private currentCharacterId: string | null = null

  constructor() {
    this.loadFromStorage()
    this.initializeDefaultCharacter()
  }

  private generateId(): string {
    return Date.now().toString() + Math.random().toString(36).substring(2)
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const charactersArray: Character[] = JSON.parse(stored)
        this.characters.clear()
        charactersArray.forEach(char => {
          this.characters.set(char.id, char)
        })
      }

      const currentId = localStorage.getItem(CURRENT_CHARACTER_KEY)
      if (currentId && this.characters.has(currentId)) {
        this.currentCharacterId = currentId
      }
    } catch (error) {
      console.error('加载人设数据失败:', error)
    }
  }

  private saveToStorage(): void {
    try {
      const charactersArray = Array.from(this.characters.values())
      localStorage.setItem(STORAGE_KEY, JSON.stringify(charactersArray))
      
      if (this.currentCharacterId) {
        localStorage.setItem(CURRENT_CHARACTER_KEY, this.currentCharacterId)
      }
    } catch (error) {
      console.error('保存人设数据失败:', error)
    }
  }

  private initializeDefaultCharacter(): void {
    // 如果没有任何人设，创建默认的 06 娘
    if (this.characters.size === 0) {
      const defaultChar = this.createCharacter(DEFAULT_CHARACTER)
      this.setCurrentCharacter(defaultChar.id)
    }
    
    // 如果没有当前人设，使用第一个
    if (!this.currentCharacterId && this.characters.size > 0) {
      const firstChar = Array.from(this.characters.values())[0]
      this.setCurrentCharacter(firstChar.id)
    }
  }

  getCharacter(id: string): Character | null {
    return this.characters.get(id) || null
  }

  getAllCharacters(): Character[] {
    return Array.from(this.characters.values()).sort((a, b) => b.updatedAt - a.updatedAt)
  }

  createCharacter(character: Omit<Character, 'id' | 'createdAt' | 'updatedAt'>): Character {
    const id = this.generateId()
    const now = Date.now()
    
    const newCharacter: Character = {
      ...character,
      id,
      createdAt: now,
      updatedAt: now
    }

    this.characters.set(id, newCharacter)
    this.saveToStorage()
    
    return newCharacter
  }

  updateCharacter(id: string, updates: Partial<Character>): Character {
    const existing = this.characters.get(id)
    if (!existing) {
      throw new Error(`人设 ${id} 不存在`)
    }

    const updated: Character = {
      ...existing,
      ...updates,
      id: existing.id, // 确保 ID 不会被覆盖
      createdAt: existing.createdAt,
      updatedAt: Date.now()
    }

    this.characters.set(id, updated)
    this.saveToStorage()
    
    return updated
  }

  deleteCharacter(id: string): boolean {
    if (!this.characters.has(id)) {
      return false
    }

    this.characters.delete(id)
    
    // 如果删除的是当前人设，切换到其他人设
    if (this.currentCharacterId === id) {
      const remaining = Array.from(this.characters.values())
      if (remaining.length > 0) {
        this.setCurrentCharacter(remaining[0].id)
      } else {
        this.currentCharacterId = null
        localStorage.removeItem(CURRENT_CHARACTER_KEY)
      }
    }

    this.saveToStorage()
    return true
  }

  getCurrentCharacter(): Character | null {
    if (!this.currentCharacterId) {
      return null
    }
    return this.getCharacter(this.currentCharacterId)
  }

  setCurrentCharacter(id: string): void {
    if (!this.characters.has(id)) {
      throw new Error(`人设 ${id} 不存在`)
    }
    
    this.currentCharacterId = id
    localStorage.setItem(CURRENT_CHARACTER_KEY, id)
  }

  // 辅助方法：从系统提示词创建简单人设
  createFromSystemPrompt(name: string, systemPrompt: string): Character {
    return this.createCharacter({
      name,
      systemPrompt,
      description: '从系统提示词创建的人设',
      personality: {
        traits: [],
        relationships: {},
        preferences: {}
      }
    })
  }

  // 辅助方法：导出人设
  exportCharacter(id: string): string | null {
    const character = this.getCharacter(id)
    if (!character) {
      return null
    }
    
    return JSON.stringify(character, null, 2)
  }

  // 辅助方法：导入人设
  importCharacter(characterData: string): Character {
    try {
      const parsed: Character = JSON.parse(characterData)
      
      // 验证必需字段
      if (!parsed.name || !parsed.systemPrompt) {
        throw new Error('人设数据不完整')
      }

      // 创建新人设（重新生成 ID 和时间戳）
      return this.createCharacter({
        name: parsed.name,
        systemPrompt: parsed.systemPrompt,
        avatar: parsed.avatar,
        description: parsed.description,
        personality: parsed.personality
      })
    } catch (error) {
      throw new Error(`导入人设失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  // 辅助方法：重置为默认人设
  resetToDefault(): Character {
    // 清除所有人设
    this.characters.clear()
    this.currentCharacterId = null
    
    // 重新初始化默认人设
    this.initializeDefaultCharacter()
    this.saveToStorage()
    
    return this.getCurrentCharacter()!
  }
}

// 创建单例实例
export const characterService = new CharacterServiceImpl()

// 导出服务类型和默认人设供测试使用
export { type Character, DEFAULT_CHARACTER }