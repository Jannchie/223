/**
 * Dexie IndexedDB 数据库配置
 * 提供类型安全的 IndexedDB 访问层
 */

import type { EntityTable } from 'dexie'
import type { Character, ChatSession, ExtendedMessage, Memory } from '../types/chat'
import Dexie from 'dexie'

// 数据库版本和名称
const DB_NAME = 'NiNiSanDB'
const DB_VERSION = 1

// 扩展接口以支持索引
export interface DbChatSession extends ChatSession {
  // 索引字段
  characterId: string
  updatedAt: number
  createdAt: number
}

export interface DbMessage extends ExtendedMessage {
  // 索引字段
  sessionId: string
}

export interface DbCharacter extends Character {
  // 索引字段
  updatedAt: number
  createdAt: number
}

export interface DbMemory extends Memory {
  // 索引字段（Memory 已经包含了这些字段）
}

// 数据库类定义
export class NiNiSanDatabase extends Dexie {
  // 表定义
  sessions!: EntityTable<DbChatSession, 'id'>
  messages!: EntityTable<DbMessage, 'id'>
  characters!: EntityTable<DbCharacter, 'id'>
  memories!: EntityTable<DbMemory, 'id'>

  constructor() {
    super(DB_NAME)

    // 数据库 schema 定义
    this.version(DB_VERSION).stores({
      // 会话表 - 按角色ID、更新时间索引
      sessions: '++id, characterId, updatedAt, createdAt',

      // 消息表 - 按会话ID、时间戳、角色索引
      messages: '++id, sessionId, timestamp, role',

      // 角色表 - 按更新时间索引
      characters: '++id, updatedAt, createdAt',

      // 记忆表 - 按类型、重要性、更新时间、关键词索引
      memories: '++id, type, importance, updatedAt, lastAccessed, *keywords',
    })

    // 数据验证和转换钩子
    this.sessions.hook('creating', (_primKey, obj: any) => {
      const now = Date.now()
      obj.createdAt = obj.createdAt || now
      obj.updatedAt = now
    })

    this.sessions.hook('updating', (modifications: any) => {
      modifications.updatedAt = Date.now()
    })

    this.messages.hook('creating', (_primKey, obj: any) => {
      obj.timestamp = obj.timestamp || Date.now()
    })

    this.characters.hook('creating', (_primKey, obj: any) => {
      const now = Date.now()
      obj.createdAt = obj.createdAt || now
      obj.updatedAt = now
    })

    this.characters.hook('updating', (modifications: any) => {
      modifications.updatedAt = Date.now()
    })

    this.memories.hook('creating', (_primKey, obj: any) => {
      const now = Date.now()
      obj.createdAt = obj.createdAt || now
      obj.updatedAt = now
      obj.lastAccessed = obj.lastAccessed || now
    })

    this.memories.hook('updating', (modifications: any) => {
      modifications.updatedAt = Date.now()
    })
  }
}

// 数据库实例（单例）
export const db = new NiNiSanDatabase()

// 数据库初始化
export async function initializeDatabase(): Promise<void> {
  try {
    await db.open()
    console.log('数据库初始化成功')
  }
  catch (error) {
    console.error('数据库初始化失败:', error)
    throw error
  }
}

// 数据库清理工具
export async function clearDatabase(): Promise<void> {
  await db.transaction('rw', db.sessions, db.messages, db.characters, db.memories, async () => {
    await Promise.all([
      db.sessions.clear(),
      db.messages.clear(),
      db.characters.clear(),
      db.memories.clear(),
    ])
  })
}

// 数据库状态检查
export async function getDatabaseStats(): Promise<{
  sessions: number
  messages: number
  characters: number
  memories: number
  size?: number
}> {
  return {
    sessions: await db.sessions.count(),
    messages: await db.messages.count(),
    characters: await db.characters.count(),
    memories: await db.memories.count(),
  }
}
