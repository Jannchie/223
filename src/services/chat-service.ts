/**
 * 核心聊天服务
 * 使用 Vercel AI SDK 实现流式聊天功能
 */

import type {
  AIProvider,
  Character,
  ChatConfig,
  ChatContext,
  ChatService,
  ExtendedMessage,
  Memory,
  StreamingCallbacks,
} from '../types/chat'
import { createOpenAI } from '@ai-sdk/openai'
// import { createAnthropic } from '@ai-sdk/anthropic'
// import { createGoogle } from '@ai-sdk/google'
// import { createCohere } from '@ai-sdk/cohere'
import { streamText } from 'ai'
import { memoryService } from './memory-service'

class ChatServiceImpl implements ChatService {
  private validateProvider(provider: AIProvider): boolean {
    const supportedProviders: AIProvider[] = ['openai'] // 暂时只支持 OpenAI
    return supportedProviders.includes(provider)
  }

  validateConfig(config: ChatConfig): boolean {
    try {
      // 检查必需字段
      if (!config.apiKey || !config.provider || !config.model) {
        console.error('聊天配置缺少必需字段')
        return false
      }

      // 检查提供商支持
      if (!this.validateProvider(config.provider)) {
        console.error(`不支持的 AI 提供商: ${config.provider}`)
        return false
      }

      // 检查参数范围
      if (config.temperature !== undefined && (config.temperature < 0 || config.temperature > 2)) {
        console.error('temperature 参数应在 0-2 范围内')
        return false
      }

      if (config.maxTokens !== undefined && config.maxTokens < 1) {
        console.error('maxTokens 参数应大于 0')
        return false
      }

      return true
    }
    catch (error) {
      console.error('配置验证失败:', error)
      return false
    }
  }

  generateSystemPrompt(character: Character, memories: Memory[]): string {
    let systemPrompt = character.systemPrompt

    // 如果有相关记忆，添加到系统提示词中
    if (memories.length > 0) {
      systemPrompt += '\n\n## 相关记忆信息\n'
      systemPrompt += '以下是一些可能相关的历史信息，请适当参考：\n\n'

      for (const [index, memory] of memories.entries()) {
        systemPrompt += `${index + 1}. ${memory.content}\n`
      }

      systemPrompt += '\n注意：这些信息可能帮助你更好地理解用户的情况和偏好，但请自然地融入对话中，不要机械地重复这些内容。'
    }

    return systemPrompt
  }

  async sendMessage(
    content: string,
    context: ChatContext,
    callbacks: StreamingCallbacks,
  ): Promise<void> {
    try {
      // 验证配置
      if (!this.validateConfig(context.config)) {
        callbacks.onError?.('聊天配置无效')
        return
      }

      // 准备消息历史
      const messages = context.currentSession.messages.map(msg => ({
        role: msg.role as 'system' | 'user' | 'assistant',
        content: msg.content,
      }))

      // 添加当前用户消息
      messages.push({
        role: 'user' as const,
        content,
      })

      // 生成包含记忆的系统提示词
      const systemPrompt = this.generateSystemPrompt(context.character, context.recentMemories)

      // 创建模型实例（根据 AI SDK 示例的正确用法）
      const model = this.createModel(context.config)

      // 准备流式请求参数
      const streamParams = {
        model,
        system: systemPrompt,
        messages,
        temperature: context.config.temperature || 0.7,
        maxTokens: context.config.maxTokens || 2000,
      }

      // 执行流式请求
      const { textStream, usage } = await streamText(streamParams)

      let fullContent = ''

      // 处理流式响应
      for await (const delta of textStream) {
        fullContent += delta
        callbacks.onToken?.(delta)
      }

      // 等待使用统计
      const finalUsage = await usage

      // 传递元数据
      callbacks.onMetadata?.({
        model: context.config.model,
        provider: context.config.provider,
        tokenCount: finalUsage.totalTokens,
      })

      // 完成回调
      callbacks.onComplete?.(fullContent)

      // 从助手回复中提取新记忆
      this.extractAndSaveMemories(fullContent, 'assistant')
    }
    catch (error) {
      console.error('聊天服务错误:', error)

      let errorMessage = '发送消息失败'
      if (error instanceof Error) {
        errorMessage = error.message
      }

      // 处理常见错误
      if (errorMessage.includes('401') || errorMessage.includes('Invalid API key')) {
        errorMessage = 'API Key 无效，请检查设置'
      }
      else if (errorMessage.includes('429') || errorMessage.includes('quota')) {
        errorMessage = 'API 配额不足或请求过于频繁'
      }
      else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        errorMessage = '网络连接失败，请检查网络设置'
      }

      callbacks.onError?.(errorMessage)
    }
  }

  private createModel(config: ChatConfig) {
    // 确保 API key 存在
    if (!config.apiKey) {
      throw new Error(`${config.provider} API Key 未配置`)
    }

    const providerConfig: any = {
      apiKey: config.apiKey,
    }

    // 只有在提供了 baseURL 时才添加
    if (config.baseURL) {
      providerConfig.baseURL = config.baseURL
    }

    switch (config.provider) {
      case 'openai': {
        const provider = createOpenAI(providerConfig)
        return provider(config.model)
      }
      // case 'anthropic': {
      //   const provider = createAnthropic(providerConfig)
      //   return provider(config.model)
      // }
      // case 'google': {
      //   const provider = createGoogle(providerConfig)
      //   return provider(config.model)
      // }
      // case 'cohere': {
      //   const provider = createCohere(providerConfig)
      //   return provider(config.model)
      // }
      default: {
        throw new Error(`不支持的提供商: ${config.provider}`)
      }
    }
  }

  private extractAndSaveMemories(content: string, role: 'user' | 'assistant'): void {
    try {
      // 创建临时消息对象用于提取记忆
      const tempMessage: ExtendedMessage = {
        id: 'temp',
        role,
        content,
        timestamp: Date.now(),
      }

      // 提取记忆
      const newMemories = memoryService.extractMemoriesFromMessage(tempMessage)

      if (newMemories.length > 0) {
        // 保存新记忆
        for (const memoryData of newMemories) {
          memoryService.addMemory(memoryData)
        }
      }
    }
    catch (error) {
      console.error('提取记忆失败:', error)
    }
  }

  // 辅助方法：获取相关记忆
  async getRelevantMemories(query: string, limit: number = 5): Promise<Memory[]> {
    try {
      const searchResults = memoryService.searchMemories(query, limit)
      return searchResults.map(result => result.memory)
    }
    catch (error) {
      console.error('获取相关记忆失败:', error)
      return []
    }
  }

  // 辅助方法：预处理用户输入
  preprocessUserInput(content: string): string {
    // 去除多余空白字符
    return content.trim().replaceAll(/\s+/g, ' ')
  }

  // 辅助方法：后处理助手回复
  postprocessAssistantResponse(content: string): string {
    // 清理回复格式
    return content.trim()
  }

  // 辅助方法：估算 token 数量（简单估算）
  estimateTokens(text: string): number {
    // 粗略估算：中文字符按 1.5 个 token 计算，英文单词按 1.3 个 token 计算
    const chineseChars = (text.match(/[\u4E00-\u9FA5]/g) || []).length
    const englishWords = (text.match(/[a-z]+/gi) || []).length
    const otherChars = text.length - chineseChars - englishWords

    return Math.ceil(chineseChars * 1.5 + englishWords * 1.3 + otherChars * 0.5)
  }

  // 辅助方法：获取模型信息
  getModelInfo(provider: AIProvider, model: string): {
    name: string
    maxTokens: number
    costPer1kTokens?: number
  } {
    const modelInfoMap: Record<string, Record<string, any>> = {
      openai: {
        'gpt-4o': { name: 'GPT-4o', maxTokens: 128_000, costPer1kTokens: 0.005 },
        'gpt-4o-mini': { name: 'GPT-4o Mini', maxTokens: 128_000, costPer1kTokens: 0.000_15 },
        'gpt-4-turbo': { name: 'GPT-4 Turbo', maxTokens: 128_000, costPer1kTokens: 0.01 },
        'gpt-3.5-turbo': { name: 'GPT-3.5 Turbo', maxTokens: 16_385, costPer1kTokens: 0.001 },
      },
      anthropic: {
        'claude-3-5-sonnet-20241022': { name: 'Claude 3.5 Sonnet', maxTokens: 200_000, costPer1kTokens: 0.003 },
        'claude-3-5-haiku-20241022': { name: 'Claude 3.5 Haiku', maxTokens: 200_000, costPer1kTokens: 0.0008 },
        'claude-3-opus-20240229': { name: 'Claude 3 Opus', maxTokens: 200_000, costPer1kTokens: 0.015 },
      },
      google: {
        'gemini-1.5-pro': { name: 'Gemini 1.5 Pro', maxTokens: 2_097_152, costPer1kTokens: 0.007 },
        'gemini-1.5-flash': { name: 'Gemini 1.5 Flash', maxTokens: 1_048_576, costPer1kTokens: 0.0015 },
        'gemini-pro': { name: 'Gemini Pro', maxTokens: 32_768, costPer1kTokens: 0.0005 },
      },
      cohere: {
        'command-r-plus': { name: 'Command R+', maxTokens: 128_000, costPer1kTokens: 0.003 },
        'command-r': { name: 'Command R', maxTokens: 128_000, costPer1kTokens: 0.0015 },
        'command': { name: 'Command', maxTokens: 4096, costPer1kTokens: 0.001 },
      },
    }

    const providerModels = modelInfoMap[provider] || {}
    return providerModels[model] || { name: model, maxTokens: 4096 }
  }

  // 辅助方法：检查上下文长度
  checkContextLength(messages: any[], maxTokens: number): boolean {
    const totalTokens = messages.reduce((sum, msg) => {
      return sum + this.estimateTokens(msg.content)
    }, 0)

    return totalTokens < maxTokens * 0.8 // 保留 20% 的空间给回复
  }

  // 辅助方法：修剪上下文
  trimContext(messages: any[], maxTokens: number): any[] {
    if (this.checkContextLength(messages, maxTokens)) {
      return messages
    }

    // 保留最后几条消息，确保不超过 token 限制
    let totalTokens = 0
    const trimmedMessages: any[] = []

    for (let i = messages.length - 1; i >= 0; i--) {
      const messageTokens = this.estimateTokens(messages[i].content)

      if (totalTokens + messageTokens < maxTokens * 0.6) { // 保留 40% 空间
        trimmedMessages.unshift(messages[i])
        totalTokens += messageTokens
      }
      else {
        break
      }
    }

    return trimmedMessages
  }
}

// 创建单例实例
export const chatService = new ChatServiceImpl()

export { type ChatConfig, type ChatContext, type ChatService } from '../types/chat'
