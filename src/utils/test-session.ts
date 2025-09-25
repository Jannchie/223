/**
 * 简单的会话测试工具
 * 用于验证会话管理是否正常工作
 */

import { messageService } from '../services/message-service'

function assertCondition(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

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

    assertCondition(currentSession, '消息服务未能创建默认会话')

    // 记录初始消息数量
    const existingMessages = await messageService.getMessages(currentSession.id)
    console.log('2. 当前会话已有消息数量:', existingMessages.length)

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

      assertCondition(testMessage.id.length > 0, '测试消息未返回有效的 ID')
      assertCondition(testMessage.content === '这是一个测试消息', '测试消息内容与预期不符')

      // 4. 获取会话消息
      const messages = await messageService.getMessages(currentSession.id)
      console.log('4. 当前会话消息数量:', messages.length)

      assertCondition(messages.length === existingMessages.length + 1, '消息数量未按预期增加')
      assertCondition(messages.some(message => message.id === testMessage.id), '新消息未出现在消息列表中')
      const latestMessage = messages[messages.length - 1]
      assertCondition(latestMessage?.timestamp >= testMessage.timestamp, '新消息未按时间顺序追加到末尾')

      const detailedStats = await messageService.getMessageStats(currentSession.id)
      assertCondition(detailedStats.totalMessages === messages.length, '消息统计与实际数量不符')
      assertCondition((detailedStats.messagesByRole.user ?? 0) >= 1, '用户消息数量统计异常')
      assertCondition(detailedStats.timeSpan.start !== null && detailedStats.timeSpan.end !== null, '消息时间范围统计缺失')
      assertCondition(detailedStats.timeSpan.end >= detailedStats.timeSpan.start, '消息时间范围统计顺序异常')

      // 5. 获取会话统计
      const stats = await messageService.getSessionStats(currentSession.id)
      console.log('5. 会话统计:', stats)

      assertCondition(stats !== null, '无法获取会话统计数据')
      const finalStats = stats!
      assertCondition(finalStats.messageCount === messages.length, '会话统计中的消息数量与实际不符')
      assertCondition(finalStats.lastActivity >= testMessage.timestamp, '会话统计的最后活跃时间未更新')
    }

    const refreshedSession = await messageService.getCurrentSession()
    assertCondition(refreshedSession?.id === currentSession.id, '当前会话 ID 在测试过程中发生变化')

    if (refreshedSession) {
      console.log('6. 当前会话验证成功:', refreshedSession.id)
    }

    console.log('=== 会话管理测试完成 ===')
    return true
  }
  catch (error) {
    console.error('=== 会话管理测试失败 ===', error)
    return false
  }
}
