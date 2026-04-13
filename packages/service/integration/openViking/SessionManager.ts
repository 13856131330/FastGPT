/**
 * OpenViking 会话管理器
 * 管理检索会话，支持迭代检索和上下文维护
 */

import type { OpenVikingClient } from './OpenVikingClient';
import type {
  MessagePart,
  MessageRole,
  SessionContext,
  MatchedContext
} from '@fastgpt/global/integration/openViking/type';

/**
 * 会话管理器配置
 */
export type SessionManagerConfig = {
  /** OpenViking 客户端 */
  client: OpenVikingClient;
  /** 会话 ID（可选，不提供则自动创建） */
  sessionId?: string;
  /** 是否自动提交（在每次 used 后自动 commit） */
  autoCommit?: boolean;
};

/**
 * 活跃会话
 */
export type ActiveSession = {
  id: string;
  createdAt: Date;
  lastUsedAt: Date;
  usedContexts: string[];
};

/**
 * OpenViking 会话管理器
 * 提供会话创建、消息管理、上下文记录和迭代检索支持
 */
export class OpenVikingSessionManager {
  private client: OpenVikingClient;
  private sessionId?: string;
  private autoCommit: boolean;
  private activeSession?: ActiveSession;
  private initialized: boolean = false;

  constructor(config: SessionManagerConfig) {
    this.client = config.client;
    this.sessionId = config.sessionId;
    this.autoCommit = config.autoCommit || false;
  }

  /**
   * 初始化会话
   * 如果未提供 sessionId，则创建新会话
   */
  async initialize(): Promise<string> {
    if (this.initialized && this.sessionId) {
      return this.sessionId;
    }

    if (this.sessionId) {
      // 使用现有会话
      this.activeSession = {
        id: this.sessionId,
        createdAt: new Date(),
        lastUsedAt: new Date(),
        usedContexts: []
      };
    } else {
      // 创建新会话
      this.sessionId = await this.client.createSession();
      this.activeSession = {
        id: this.sessionId,
        createdAt: new Date(),
        lastUsedAt: new Date(),
        usedContexts: []
      };
    }

    this.initialized = true;
    return this.sessionId;
  }

  /**
   * 获取当前会话 ID
   */
  getSessionId(): string | undefined {
    return this.sessionId;
  }

  /**
   * 获取活跃会话信息
   */
  getActiveSession(): ActiveSession | undefined {
    return this.activeSession;
  }

  /**
   * 添加用户消息
   * @param content 消息内容
   */
  async addUserMessage(content: string): Promise<void> {
    await this.ensureInitialized();
    await this.client.addMessage({
      sessionId: this.sessionId!,
      role: 'user',
      content
    });
    this.updateLastUsed();
  }

  /**
   * 添加助手消息（可带上下文引用）
   * @param content 消息内容
   * @param contexts 引用的上下文
   */
  async addAssistantMessage(
    content: string,
    contexts?: Array<{ uri: string; abstract: string }>
  ): Promise<void> {
    await this.ensureInitialized();

    const parts: MessagePart[] = [];

    // 添加文本部分
    if (content) {
      parts.push({
        type: 'text',
        text: content
      });
    }

    // 添加上下文引用部分
    if (contexts && contexts.length > 0) {
      for (const ctx of contexts) {
        parts.push({
          type: 'context',
          uri: ctx.uri,
          contextType: 'RESOURCE',
          abstract: ctx.abstract
        });
      }
    }

    await this.client.addMessage({
      sessionId: this.sessionId!,
      role: 'assistant',
      parts
    });
    this.updateLastUsed();
  }

  /**
   * 记录使用的上下文
   * @param contexts 使用的上下文 URI 列表
   */
  async recordUsedContexts(contexts: string[]): Promise<void> {
    await this.ensureInitialized();

    await this.client.used({
      sessionId: this.sessionId!,
      contexts
    });

    // 更新本地记录
    if (this.activeSession) {
      this.activeSession.usedContexts.push(...contexts);
      this.updateLastUsed();
    }

    // 如果启用自动提交
    if (this.autoCommit) {
      await this.commit();
    }
  }

  /**
   * 记录使用的技能
   * @param skillUri 技能 URI
   * @param input 输入
   * @param output 输出
   * @param success 是否成功
   */
  async recordUsedSkill(
    skillUri: string,
    input: string,
    output: string,
    success: boolean
  ): Promise<void> {
    await this.ensureInitialized();

    await this.client.used({
      sessionId: this.sessionId!,
      skill: {
        uri: skillUri,
        input,
        output,
        success
      }
    });
    this.updateLastUsed();

    if (this.autoCommit) {
      await this.commit();
    }
  }

  /**
   * 获取会话上下文
   * @param tokenBudget Token 预算
   */
  async getContext(tokenBudget?: number): Promise<SessionContext> {
    await this.ensureInitialized();
    return this.client.getSessionContext(this.sessionId!, tokenBudget);
  }

  /**
   * 提交会话（触发记忆提取）
   * @returns 任务 ID
   */
  async commit(): Promise<string> {
    await this.ensureInitialized();
    const result = await this.client.commitSession(this.sessionId!);
    return result.task_id;
  }

  /**
   * 等待后台任务完成
   * @param taskId 任务 ID
   * @param maxWait 最大等待时间（毫秒）
   */
  async waitForTask(taskId: string, maxWait: number = 60000): Promise<void> {
    const startTime = Date.now();
    const pollInterval = 1000;

    while (Date.now() - startTime < maxWait) {
      const task = await this.client.getTask(taskId);

      if (task.status === 'completed') {
        return;
      }

      if (task.status === 'failed') {
        throw new Error(`Task failed: ${task.error || 'Unknown error'}`);
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new Error(`Task timed out after ${maxWait}ms`);
  }

  /**
   * 获取已使用的上下文 URI 列表
   */
  getUsedContexts(): string[] {
    return this.activeSession?.usedContexts || [];
  }

  /**
   * 清理会话
   */
  async cleanup(): Promise<void> {
    if (this.sessionId) {
      try {
        await this.client.deleteSession(this.sessionId);
      } catch (error) {
        // 忽略删除错误
        console.warn('Failed to cleanup session:', error);
      }
    }
    this.sessionId = undefined;
    this.activeSession = undefined;
    this.initialized = false;
  }

  // ==================== 私有方法 ====================

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private updateLastUsed(): void {
    if (this.activeSession) {
      this.activeSession.lastUsedAt = new Date();
    }
  }
}

/**
 * 创建会话管理器
 */
export function createSessionManager(config: SessionManagerConfig): OpenVikingSessionManager {
  return new OpenVikingSessionManager(config);
}
