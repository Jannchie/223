/**
 * 简单的会话测试工具
 * 用于验证会话管理是否正常工作
 */

import { messageService } from '../services/message-service'

export async function testSessionManagement() {
  console.log('=== 开始会话管理测试 ===')

  try {
    // 1. 获取当前会话
    let currentSession = await messageService.getCurrentSession()
    console.log('1. 当前会话:', currentSession ? currentSession.id : 'null')

    // 2. 如果没有会话，应该自动创建
    if (!currentSession) {
      console.log('2. 没有当前会话，等待自动创建...')
      // 再次尝试获取
      currentSession = await messageService.getCurrentSession()
      console.log('2. 自动创建后的会话:', currentSession ? currentSession.id : 'null')
    }

    // 3. 添加测试消息
    if (currentSession) {
      console.log('3. 向会话添加测试消息...')
      const testMessage = await messageService.addMessage(currentSession.id, {
        role: 'user',
        content: '这是一个测试消息',
        metadata: {
          provider: 'openai',
          model: 'test',
        },
      })
      console.log('3. 测试消息已添加:', testMessage.id)

      // 4. 获取会话消息
      const messages = await messageService.getMessages(currentSession.id)
      console.log('4. 当前会话消息数量:', messages.length)

      // 5. 获取会话统计
      const stats = await messageService.getSessionStats(currentSession.id)
      console.log('5. 会话统计:', stats)
    }

    console.log('=== 会话管理测试完成 ===')
    return true
  }
  catch (error) {
    console.error('=== 会话管理测试失败 ===', error)
    return false
  }
}
