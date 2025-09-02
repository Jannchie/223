/**
 * 截图吐槽功能工具类
 * 整合截图功能和 AI 吐槽生成
 */

import type { ChatConfig, StreamingCallbacks } from '../types/chat'
import { chatService } from '../services/chat-service'
import { getRoastPrompt, type RoastStyle } from './screenshot-prompts'

export interface ScreenshotRoastConfig {
  enabled: boolean
  interval: number // 分钟
  style: RoastStyle
  autoTrigger: boolean
}

export interface RoastResult {
  text: string
  timestamp: number
  contentHash?: string // 内容特征哈希，用于相似度判断
  screenshot?: string // 可选保存截图用于调试
}

export interface StreamingRoastCallbacks {
  onStart: () => void
  onToken: (token: string) => void
  onComplete: (result: RoastResult) => void
  onError: (error: string) => void
}

export class ScreenshotRoastManager {
  private config: ScreenshotRoastConfig = {
    enabled: false,
    interval: 5,
    style: 'default',
    autoTrigger: false
  }

  private timer: NodeJS.Timeout | null = null
  private isProcessing = false

  constructor(
    private chatConfig: ChatConfig,
    private onRoast: (result: RoastResult) => void,
    private onError: (error: string) => void,
    private streamingCallbacks?: StreamingRoastCallbacks,
    private roastHistoryManager?: RoastHistoryManager
  ) {}

  // 更新配置
  updateConfig(newConfig: Partial<ScreenshotRoastConfig>) {
    this.config = { ...this.config, ...newConfig }
    
    if (this.config.enabled && this.config.autoTrigger) {
      this.startAutoRoast()
    } else {
      this.stopAutoRoast()
    }
  }

  // 更新聊天配置
  updateChatConfig(newChatConfig: ChatConfig) {
    this.chatConfig = newChatConfig
  }

  // 更新流式回调
  updateStreamingCallbacks(callbacks?: StreamingRoastCallbacks) {
    this.streamingCallbacks = callbacks
  }

  // 手动触发截图吐槽
  async triggerRoast(): Promise<void> {
    if (this.isProcessing) {
      this.onError('正在处理中，请稍候...')
      return
    }

    this.isProcessing = true

    try {
      // 获取截图
      const screenshot = await this.takeScreenshot()
      if (!screenshot) {
        throw new Error('截图失败')
      }

      // 生成吐槽
      await this.generateRoast(screenshot)
    } catch (error) {
      console.error('截图吐槽失败:', error)
      this.onError(error instanceof Error ? error.message : '未知错误')
    } finally {
      this.isProcessing = false
    }
  }

  // 启动自动吐槽定时器
  private startAutoRoast() {
    this.stopAutoRoast()
    
    this.timer = setInterval(async () => {
      if (this.config.enabled && !this.isProcessing) {
        await this.triggerRoast()
      }
    }, this.config.interval * 60 * 1000)
  }

  // 停止自动吐槽定时器
  private stopAutoRoast() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  // 截图
  private async takeScreenshot(): Promise<string | null> {
    try {
      if (!(globalThis as any).electronAPI?.takeScreenshot) {
        throw new Error('截图功能不可用')
      }

      const screenshot = await (globalThis as any).electronAPI.takeScreenshot()
      return screenshot
    } catch (error) {
      console.error('截图失败:', error)
      return null
    }
  }

  // 生成吐槽
  private async generateRoast(screenshot: string): Promise<void> {
    // 检查是否与最近的内容相似，避免重复吐槽
    if (this.roastHistoryManager?.shouldSkipSimilarContent(screenshot)) {
      console.log('内容相似，跳过本次吐槽')
      return
    }

    const prompt = getRoastPrompt(this.config.style)
    const roastText = "请看看我的屏幕，给我来一段吐槽吧！"

    let fullContent = ''

    // 如果有流式回调，触发开始事件
    if (this.streamingCallbacks?.onStart) {
      this.streamingCallbacks.onStart()
    }

    const callbacks: StreamingCallbacks = {
      onToken: (token: string) => {
        fullContent += token
        // 如果有流式回调，触发token事件
        if (this.streamingCallbacks?.onToken) {
          this.streamingCallbacks.onToken(token)
        }
      },
      onComplete: (content: string) => {
        const result: RoastResult = {
          text: content,
          timestamp: Date.now(),
          // 不保存截图本体，节省内存空间
        }
        
        // 添加到历史记录（包含内容特征）
        if (this.roastHistoryManager) {
          this.roastHistoryManager.addRoastWithContentCheck(result, screenshot)
        }
        
        // 如果有流式回调，使用流式完成回调；否则使用传统回调
        if (this.streamingCallbacks?.onComplete) {
          this.streamingCallbacks.onComplete(result)
        } else {
          this.onRoast(result)
        }
      },
      onError: (error: string) => {
        const errorMsg = `AI 吐槽生成失败: ${error}`
        // 如果有流式回调，使用流式错误回调；否则使用传统回调
        if (this.streamingCallbacks?.onError) {
          this.streamingCallbacks.onError(errorMsg)
        } else {
          this.onError(errorMsg)
        }
      }
    }

    try {
      await chatService.sendMessageWithImage(
        roastText,
        screenshot,
        this.chatConfig,
        prompt,
        callbacks
      )
    } catch (error) {
      console.error('发送图片消息失败:', error)
      this.onError('发送图片消息失败')
    }
  }

  // 获取当前配置
  getConfig(): ScreenshotRoastConfig {
    return { ...this.config }
  }

  // 检查是否正在处理
  isProcessingRoast(): boolean {
    return this.isProcessing
  }

  // 销毁实例
  destroy() {
    this.stopAutoRoast()
    this.isProcessing = false
  }
}

// 吐槽历史管理（带记忆功能）
export class RoastHistoryManager {
  private history: RoastResult[] = []
  private maxHistorySize = 10 // 只保留最近的 10 个吐槽
  private similarityThreshold = 0.8 // 相似度阈值，超过此值认为是重复内容

  addRoast(result: RoastResult) {
    this.history.unshift(result)
    
    // 限制历史记录数量
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(0, this.maxHistorySize)
    }
  }

  getHistory(): RoastResult[] {
    return [...this.history]
  }

  clearHistory() {
    this.history = []
  }

  getLatest(): RoastResult | null {
    return this.history[0] || null
  }

  // 按时间范围获取历史记录
  getHistoryByTimeRange(startTime: number, endTime: number): RoastResult[] {
    return this.history.filter(roast => 
      roast.timestamp >= startTime && roast.timestamp <= endTime
    )
  }

  // 搜索历史记录
  searchHistory(query: string): RoastResult[] {
    const lowerQuery = query.toLowerCase()
    return this.history.filter(roast => 
      roast.text.toLowerCase().includes(lowerQuery)
    )
  }

  // 生成内容特征哈希（简单的文本特征提取）
  private generateContentHash(screenshot: string): string {
    // 使用简单的哈希算法，基于图片的尺寸和部分像素信息
    let hash = 0
    const str = screenshot.substring(0, Math.min(1000, screenshot.length)) // 只取前1000个字符
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // 转换为32位整数
    }
    
    return Math.abs(hash).toString(36)
  }

  // 计算两个哈希的相似度（简化版本）
  private calculateSimilarity(hash1: string, hash2: string): number {
    if (!hash1 || !hash2) return 0
    
    // 简单的字符串相似度计算
    const maxLen = Math.max(hash1.length, hash2.length)
    let matches = 0
    
    for (let i = 0; i < Math.min(hash1.length, hash2.length); i++) {
      if (hash1[i] === hash2[i]) {
        matches++
      }
    }
    
    return matches / maxLen
  }

  // 检查是否应该跳过相似内容
  shouldSkipSimilarContent(screenshot: string): boolean {
    const contentHash = this.generateContentHash(screenshot)
    
    // 检查是否与最近的吐槽内容相似
    for (const roast of this.history) {
      if (roast.contentHash) {
        const similarity = this.calculateSimilarity(contentHash, roast.contentHash)
        if (similarity > this.similarityThreshold) {
          console.log(`检测到相似内容，相似度: ${similarity.toFixed(2)}，跳过吐槽`)
          return true
        }
      }
    }
    
    return false
  }

  // 添加带内容哈希的吐槽记录
  addRoastWithContentCheck(result: RoastResult, screenshot?: string): boolean {
    if (screenshot) {
      result.contentHash = this.generateContentHash(screenshot)
    }
    
    this.addRoast(result)
    return true
  }

  // 设置相似度阈值
  setSimilarityThreshold(threshold: number) {
    this.similarityThreshold = Math.max(0, Math.min(1, threshold))
  }

  // 获取当前相似度阈值
  getSimilarityThreshold(): number {
    return this.similarityThreshold
  }
}