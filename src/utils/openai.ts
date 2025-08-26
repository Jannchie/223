import OpenAI from 'openai'
import { SYSTEM_PROMPT } from './system-prompt'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface StreamingResponse {
  onToken: (token: string) => void
  onComplete: (fullContent: string) => void
  onError: (error: string) => void
}

export class OpenAIChat {
  private client: OpenAI
  private messages: ChatMessage[] = []

  constructor(apiKey: string, baseURL?: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: baseURL || 'https://api.openai.com/v1',
      dangerouslyAllowBrowser: true
    })
  }

  addMessage(role: 'user' | 'assistant', content: string): ChatMessage {
    const message: ChatMessage = {
      id: Date.now().toString(),
      role,
      content,
      timestamp: Date.now()
    }
    this.messages.push(message)
    return message
  }

  getMessages(): ChatMessage[] {
    return [...this.messages]
  }

  clearMessages(): void {
    this.messages = []
  }

  async sendMessage(content: string, callbacks: StreamingResponse): Promise<void> {
    // 添加用户消息
    this.addMessage('user', content)

    try {
      // 准备消息历史，包含系统提示词
      const messages = [
        { role: 'system' as const, content: SYSTEM_PROMPT },
        ...this.messages.map(msg => ({
          role: msg.role,
          content: msg.content
        }))
      ]

      // 创建流式请求
      const stream = await this.client.chat.completions.create({
        model: 'gpt-4o',  // 使用 GPT-4o 模型
        messages,
        stream: true,
        temperature: 0.7,
        max_tokens: 2000
      })

      let fullContent = ''

      // 处理流式响应
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta
        if (delta?.content) {
          const token = delta.content
          fullContent += token
          callbacks.onToken(token)
        }
      }

      // 添加助手消息
      this.addMessage('assistant', fullContent)
      callbacks.onComplete(fullContent)

    } catch (error) {
      console.error('OpenAI API error:', error)
      callbacks.onError(error instanceof Error ? error.message : '发送消息失败')
    }
  }
}

// 创建全局实例
let chatInstance: OpenAIChat | null = null

export function initOpenAI(apiKey: string, baseURL?: string): OpenAIChat {
  chatInstance = new OpenAIChat(apiKey, baseURL)
  return chatInstance
}

export function getChatInstance(): OpenAIChat | null {
  return chatInstance
}