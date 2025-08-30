/**
 * 数据迁移工具
 * 负责从 localStorage 迁移数据到 IndexedDB
 */

import type { Character, ChatSession, Memory } from '../types/chat'
import { repositories } from '../composables/useDatabase'

// localStorage 存储键
const LEGACY_KEYS = {
  SESSIONS: 'chat-sessions',
  CURRENT_SESSION: 'current-session-id',
  CHARACTERS: 'characters',
  CURRENT_CHARACTER: 'current-character-id',
  MEMORIES: 'memories',
}

export interface MigrationResult {
  success: boolean
  migratedSessions: number
  migratedCharacters: number
  migratedMemories: number
  migratedMessages: number
  errors: string[]
}

/**
 * 主要的数据迁移函数
 */
export async function migrateFromLocalStorage(): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: false,
    migratedSessions: 0,
    migratedCharacters: 0,
    migratedMemories: 0,
    migratedMessages: 0,
    errors: [],
  }

  try {
    console.log('开始数据迁移...')

    // 1. 迁移角色数据
    await migrateCharacters(result)

    // 2. 迁移会话和消息数据
    await migrateSessions(result)

    // 3. 迁移记忆数据
    await migrateMemories(result)

    // 4. 清理成功迁移的 localStorage 数据
    if (result.errors.length === 0) {
      cleanupLocalStorage()
      result.success = true
      console.log('数据迁移完成:', result)
    }
    else {
      console.warn('数据迁移完成，但有错误:', result.errors)
    }
  }
  catch (error) {
    result.errors.push(`迁移过程出错: ${error instanceof Error ? error.message : String(error)}`)
    console.error('数据迁移失败:', error)
  }

  return result
}

/**
 * 迁移角色数据
 */
async function migrateCharacters(result: MigrationResult): Promise<void> {
  try {
    const charactersData = localStorage.getItem(LEGACY_KEYS.CHARACTERS)
    if (!charactersData) {
      console.log('没有找到旧的角色数据')
      return
    }

    const characters: Character[] = JSON.parse(charactersData)
    console.log(`找到 ${characters.length} 个角色待迁移`)

    for (const character of characters) {
      try {
        // 检查是否已存在同名角色
        const existing = await repositories.characters.getByName(character.name)
        if (existing) {
          console.log(`角色 "${character.name}" 已存在，跳过`)
          continue
        }

        // 创建新角色（去除 id 让数据库自动生成）
        const { id, ...characterData } = character
        await repositories.characters.create(characterData)
        result.migratedCharacters++

        console.log(`已迁移角色: ${character.name}`)
      }
      catch (error) {
        const errorMsg = `迁移角色 "${character.name}" 失败: ${error instanceof Error ? error.message : String(error)}`
        result.errors.push(errorMsg)
        console.error(errorMsg)
      }
    }
  }
  catch (error) {
    const errorMsg = `解析角色数据失败: ${error instanceof Error ? error.message : String(error)}`
    result.errors.push(errorMsg)
    console.error(errorMsg)
  }
}

/**
 * 迁移会话和消息数据
 */
async function migrateSessions(result: MigrationResult): Promise<void> {
  try {
    const sessionsData = localStorage.getItem(LEGACY_KEYS.SESSIONS)
    if (!sessionsData) {
      console.log('没有找到旧的会话数据')
      return
    }

    const sessions: ChatSession[] = JSON.parse(sessionsData)
    console.log(`找到 ${sessions.length} 个会话待迁移`)

    for (const session of sessions) {
      try {
        // 验证角色是否存在
        const character = await repositories.characters.getById(session.characterId)
        if (!character) {
          console.log(`会话 "${session.name}" 的角色不存在，跳过`)
          continue
        }

        // 创建会话（去除 id 和 messages）
        const { id, messages, ...sessionData } = session
        const newSession = await repositories.sessions.create({
          ...sessionData,
          messages: [], // 初始为空数组，后续添加消息
        })
        result.migratedSessions++

        // 迁移消息
        if (messages && messages.length > 0) {
          console.log(`迁移会话 "${session.name}" 的 ${messages.length} 条消息`)

          for (const message of messages) {
            try {
              // 创建消息（去除 id）
              const { id: messageId, ...messageData } = message
              await repositories.messages.create({
                ...messageData,
                sessionId: newSession.id,
              })
              result.migratedMessages++
            }
            catch (error) {
              const errorMsg = `迁移消息失败: ${error instanceof Error ? error.message : String(error)}`
              result.errors.push(errorMsg)
              console.error(errorMsg)
            }
          }
        }

        console.log(`已迁移会话: ${session.name}`)
      }
      catch (error) {
        const errorMsg = `迁移会话 "${session.name}" 失败: ${error instanceof Error ? error.message : String(error)}`
        result.errors.push(errorMsg)
        console.error(errorMsg)
      }
    }
  }
  catch (error) {
    const errorMsg = `解析会话数据失败: ${error instanceof Error ? error.message : String(error)}`
    result.errors.push(errorMsg)
    console.error(errorMsg)
  }
}

/**
 * 迁移记忆数据
 */
async function migrateMemories(result: MigrationResult): Promise<void> {
  try {
    const memoriesData = localStorage.getItem(LEGACY_KEYS.MEMORIES)
    if (!memoriesData) {
      console.log('没有找到旧的记忆数据')
      return
    }

    const memories: Memory[] = JSON.parse(memoriesData)
    console.log(`找到 ${memories.length} 条记忆待迁移`)

    for (const memory of memories) {
      try {
        // 创建记忆（去除 id）
        const { id, ...memoryData } = memory
        await repositories.memories.create(memoryData)
        result.migratedMemories++

        console.log(`已迁移记忆: ${memory.content.slice(0, 50)}...`)
      }
      catch (error) {
        const errorMsg = `迁移记忆失败: ${error instanceof Error ? error.message : String(error)}`
        result.errors.push(errorMsg)
        console.error(errorMsg)
      }
    }
  }
  catch (error) {
    const errorMsg = `解析记忆数据失败: ${error instanceof Error ? error.message : String(error)}`
    result.errors.push(errorMsg)
    console.error(errorMsg)
  }
}

/**
 * 清理已迁移的 localStorage 数据
 */
function cleanupLocalStorage(): void {
  try {
    console.log('清理旧的 localStorage 数据...')

    for (const key of Object.values(LEGACY_KEYS)) {
      localStorage.removeItem(key)
    }

    console.log('localStorage 清理完成')
  }
  catch (error) {
    console.warn('清理 localStorage 失败:', error)
  }
}

/**
 * 检查是否需要数据迁移
 */
export function needsMigration(): boolean {
  return Object.values(LEGACY_KEYS).some(key => localStorage.getItem(key) !== null)
}

/**
 * 获取待迁移的数据统计
 */
export function getMigrationPreview(): {
  hasData: boolean
  sessions: number
  characters: number
  memories: number
  estimatedMessages: number
} {
  const preview = {
    hasData: false,
    sessions: 0,
    characters: 0,
    memories: 0,
    estimatedMessages: 0,
  }

  try {
    // 检查角色数据
    const charactersData = localStorage.getItem(LEGACY_KEYS.CHARACTERS)
    if (charactersData) {
      const characters = JSON.parse(charactersData)
      preview.characters = Array.isArray(characters) ? characters.length : 0
      preview.hasData = true
    }

    // 检查会话数据
    const sessionsData = localStorage.getItem(LEGACY_KEYS.SESSIONS)
    if (sessionsData) {
      const sessions = JSON.parse(sessionsData)
      if (Array.isArray(sessions)) {
        preview.sessions = sessions.length
        preview.estimatedMessages = sessions.reduce((total, session) => {
          return total + (session.messages ? session.messages.length : 0)
        }, 0)
        preview.hasData = true
      }
    }

    // 检查记忆数据
    const memoriesData = localStorage.getItem(LEGACY_KEYS.MEMORIES)
    if (memoriesData) {
      const memories = JSON.parse(memoriesData)
      preview.memories = Array.isArray(memories) ? memories.length : 0
      preview.hasData = true
    }
  }
  catch (error) {
    console.warn('获取迁移预览失败:', error)
  }

  return preview
}

/**
 * 备份 localStorage 数据到文件
 */
export function backupLocalStorageData(): string {
  const backup = {
    timestamp: Date.now(),
    version: '1.0',
    data: {} as Record<string, any>,
  }

  for (const key of Object.values(LEGACY_KEYS)) {
    const data = localStorage.getItem(key)
    if (data) {
      try {
        backup.data[key] = JSON.parse(data)
      }
      catch {
        backup.data[key] = data
      }
    }
  }

  return JSON.stringify(backup, null, 2)
}

/**
 * 从备份恢复 localStorage 数据
 */
export function restoreFromBackup(backupData: string): boolean {
  try {
    const backup = JSON.parse(backupData)

    if (!backup.data) {
      throw new Error('备份数据格式无效')
    }

    for (const [key, value] of Object.entries(backup.data)) {
      if (Object.values(LEGACY_KEYS).includes(key)) {
        localStorage.setItem(key, JSON.stringify(value))
      }
    }

    console.log('从备份恢复数据成功')
    return true
  }
  catch (error) {
    console.error('从备份恢复数据失败:', error)
    return false
  }
}
