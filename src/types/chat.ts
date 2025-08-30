/**
 * 聊天相关的 TypeScript 类型定义
 */

import type { Ref } from 'vue'

// AI 提供商类型
export type AIProvider = 'openai' // 暂时只支持 OpenAI，其他提供商稍后启用

// 消息角色类型
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool'

// 消息基础类型
export interface BaseMessage {
  id: string
  role: MessageRole
  content: string
  timestamp: number
}

// 扩展消息类型，包含元数据
export interface ExtendedMessage extends BaseMessage {
  metadata?: {
    model?: string
    provider?: AIProvider
    tokenCount?: number
    processing?: boolean
    error?: string
    tags?: string[]
  }
}

// 聊天配置
export interface ChatConfig {
  provider: AIProvider
  model: string
  apiKey: string
  baseURL?: string
  temperature?: number
  maxTokens?: number
}

// 人设定义
export interface Character {
  id: string
  name: string
  systemPrompt: string
  avatar?: string
  description?: string
  personality?: {
    traits: string[]
    relationships: Record<string, string>
    preferences: Record<string, string>
  }
  createdAt: number
  updatedAt: number
}

// 记忆项
export interface Memory {
  id: string
  type: 'fact' | 'preference' | 'conversation' | 'event'
  content: string
  keywords: string[]
  importance: number // 1-10
  createdAt: number
  updatedAt: number
  lastAccessed: number
  relatedMessageIds: string[]
}

// 记忆查询结果
export interface MemorySearchResult {
  memory: Memory
  relevanceScore: number
}

// 聊天会话
export interface ChatSession {
  id: string
  characterId: string
  name?: string
  messages: ExtendedMessage[]
  createdAt: number
  updatedAt: number
  metadata?: {
    totalTokens?: number
    messageCount?: number
    lastActivity?: number
  }
}

// 流式响应回调
export interface StreamingCallbacks {
  onToken?: (token: string) => void
  onComplete?: (fullContent: string) => void
  onError?: (error: string) => void
  onMetadata?: (metadata: Record<string, any>) => void
}

// 聊天上下文
export interface ChatContext {
  character: Character
  recentMemories: Memory[]
  currentSession: ChatSession
  config: ChatConfig
}

// 人设服务接口
export interface CharacterService {
  getCharacter(id: string): Character | null
  getAllCharacters(): Character[]
  createCharacter(character: Omit<Character, 'id' | 'createdAt' | 'updatedAt'>): Character
  updateCharacter(id: string, updates: Partial<Character>): Character
  deleteCharacter(id: string): boolean
  getCurrentCharacter(): Character | null
  setCurrentCharacter(id: string): void
}

// 记忆服务接口
export interface MemoryService {
  addMemory(memory: Omit<Memory, 'id' | 'createdAt' | 'updatedAt'>): Memory
  searchMemories(query: string, limit?: number): MemorySearchResult[]
  getRecentMemories(limit?: number): Memory[]
  updateMemory(id: string, updates: Partial<Memory>): Memory
  deleteMemory(id: string): boolean
  getMemoriesByType(type: Memory['type']): Memory[]
  extractMemoriesFromMessage(message: ExtendedMessage): Omit<Memory, 'id' | 'createdAt' | 'updatedAt'>[]
}

// 消息服务接口
export interface MessageService {
  addMessage(sessionId: string, message: Omit<ExtendedMessage, 'id' | 'timestamp'>): ExtendedMessage
  getMessages(sessionId: string, limit?: number): ExtendedMessage[]
  updateMessage(messageId: string, updates: Partial<ExtendedMessage>): ExtendedMessage
  deleteMessage(messageId: string): boolean
  clearMessages(sessionId: string): boolean
  searchMessages(query: string, sessionId?: string): ExtendedMessage[]
}

// 聊天服务接口
export interface ChatService {
  sendMessage(
    content: string, 
    context: ChatContext, 
    callbacks: StreamingCallbacks
  ): Promise<void>
  generateSystemPrompt(character: Character, memories: Memory[]): string
  validateConfig(config: ChatConfig): boolean
}

// Vue 组合式函数返回类型
export interface UseChatReturn {
  // 状态
  messages: Ref<ExtendedMessage[]>
  isTyping: Ref<boolean>
  currentResponse: Ref<string>
  error: Ref<string | null>
  
  // 配置
  config: Ref<ChatConfig>
  character: Ref<Character | null>
  
  // 方法
  sendMessage: (content: string) => Promise<void>
  clearMessages: () => void
  setCharacter: (characterId: string) => void
  updateConfig: (newConfig: Partial<ChatConfig>) => void
}