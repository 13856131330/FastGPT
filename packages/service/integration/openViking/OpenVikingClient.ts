/**
 * OpenViking API 客户端
 * 封装与 OpenViking HTTP 服务的交互
 */

import type {
  OpenVikingConfig,
  FindParams,
  SearchParams,
  SearchResult,
  LinkParams,
  Relation,
  RelationsResponse,
  CreateSessionResponse,
  AddMessageParams,
  UsedParams,
  CommitSessionResponse,
  TaskResponse,
  SessionContext,
  AddResourceParams,
  AddResourceResponse,
  ReadContentParams,
  ReadContentResponse,
  OpenVikingError
} from '@fastgpt/global/integration/openViking/type';

/**
 * OpenViking 客户端类
 * 提供与 OpenViking HTTP API 交互的方法
 */
export class OpenVikingClient {
  private config: Required<OpenVikingConfig>;
  private baseUrl: string;

  constructor(config: OpenVikingConfig) {
    this.config = {
      endpoint: config.endpoint,
      apiKey: config.apiKey || '',
      timeout: config.timeout || 30000,
      enabled: config.enabled !== false
    };
    // 移除末尾斜杠
    this.baseUrl = this.config.endpoint.replace(/\/+$/, '');
  }

  /**
   * 检查客户端是否启用
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * 发送 HTTP 请求
   */
  private async request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = (await response.json()) as OpenVikingError;
        throw new Error(`OpenViking API error: ${errorData.error?.message || response.statusText}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`OpenViking request failed: ${String(error)}`);
    }
  }

  private async uploadTempTextFile(fileName: string, content: string): Promise<string> {
    const url = `${this.baseUrl}/api/v1/resources/temp_upload`;
    const headers: Record<string, string> = {};

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const formData = new FormData();
      formData.append('file', new Blob([content], { type: 'text/markdown' }), fileName);

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenViking API error: ${errorText || response.statusText}`);
      }

      const data = (await response.json()) as {
        result?: { temp_file_id?: string };
      };
      const tempFileId = data?.result?.temp_file_id;
      if (!tempFileId) {
        throw new Error('OpenViking temp upload failed: temp_file_id missing');
      }
      return tempFileId;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`OpenViking temp upload failed: ${String(error)}`);
    }
  }

  private getFileNameFromUri(uri: string): string {
    const cleanUri = uri.split('#')[0];
    const fileName = cleanUri.split('/').pop();
    return fileName || 'resource.md';
  }

  // ==================== 搜索 API ====================

  /**
   * 语义搜索（不带会话上下文）
   * @param params 搜索参数
   * @returns 搜索结果
   */
  async find(params: FindParams): Promise<SearchResult> {
    return this.request<SearchResult>('POST', '/api/v1/search/find', {
      query: params.query,
      target_uri: params.targetUri || '',
      limit: params.limit || 10,
      score_threshold: params.scoreThreshold,
      filter: params.filter
    });
  }

  /**
   * 上下文感知搜索（带会话上下文）
   * @param params 搜索参数
   * @returns 搜索结果
   */
  async search(params: SearchParams): Promise<SearchResult> {
    return this.request<SearchResult>('POST', '/api/v1/search/search', {
      query: params.query,
      target_uri: params.targetUri || '',
      session_id: params.sessionId,
      limit: params.limit || 10,
      score_threshold: params.scoreThreshold,
      filter: params.filter,
      telemetry: params.telemetry
    });
  }

  /**
   * 模式搜索（正则表达式）
   * @param uri 要搜索的 URI
   * @param pattern 搜索模式
   * @param caseInsensitive 是否忽略大小写
   * @returns 匹配结果
   */
  async grep(
    uri: string,
    pattern: string,
    caseInsensitive?: boolean
  ): Promise<{ matches: { uri: string; line: number; content: string }[]; count: number }> {
    return this.request('POST', '/api/v1/search/grep', {
      uri,
      pattern,
      case_insensitive: caseInsensitive
    });
  }

  /**
   * 文件模式匹配
   * @param pattern Glob 模式
   * @param uri 起始 URI
   * @returns 匹配的文件列表
   */
  async glob(pattern: string, uri?: string): Promise<{ matches: string[] }> {
    return this.request('POST', '/api/v1/search/glob', {
      pattern,
      uri: uri || 'viking://'
    });
  }

  // ==================== 关联关系 API ====================

  /**
   * 创建文档间关联
   * @param params 关联参数
   */
  async link(params: LinkParams): Promise<void> {
    await this.request('POST', '/api/v1/relations/link', {
      from_uri: params.fromUri,
      to_uris: Array.isArray(params.toUris) ? params.toUris : [params.toUris],
      reason: params.reason || ''
    });
  }

  /**
   * 获取资源的所有关联
   * @param uri 资源 URI
   * @returns 关联列表
   */
  async getRelations(uri: string): Promise<Relation[]> {
    const response = await this.request<RelationsResponse>(
      'GET',
      `/api/v1/relations?uri=${encodeURIComponent(uri)}`
    );
    return response.result || [];
  }

  /**
   * 删除关联
   * @param fromUri 源 URI
   * @param toUri 目标 URI
   */
  async unlink(fromUri: string, toUri: string): Promise<void> {
    await this.request('DELETE', '/api/v1/relations/link', {
      from_uri: fromUri,
      to_uri: toUri
    });
  }

  // ==================== 会话管理 API ====================

  /**
   * 创建新会话
   * @param sessionId 可选的会话 ID
   * @returns 会话 ID
   */
  async createSession(sessionId?: string): Promise<string> {
    const response = await this.request<CreateSessionResponse>('POST', '/api/v1/sessions', {
      session_id: sessionId
    });
    return response.session_id;
  }

  /**
   * 添加消息到会话
   * @param params 消息参数
   */
  async addMessage(params: AddMessageParams): Promise<void> {
    await this.request('POST', `/api/v1/sessions/${params.sessionId}/messages`, {
      role: params.role,
      parts: params.parts,
      content: params.content
    });
  }

  /**
   * 记录上下文使用
   * @param params 使用参数
   */
  async used(params: UsedParams): Promise<void> {
    await this.request('POST', `/api/v1/sessions/${params.sessionId}/used`, {
      contexts: params.contexts,
      skill: params.skill
    });
  }

  /**
   * 提交会话（触发记忆提取）
   * @param sessionId 会话 ID
   * @returns 任务 ID 和归档 URI
   */
  async commitSession(sessionId: string): Promise<CommitSessionResponse> {
    return this.request<CommitSessionResponse>('POST', `/api/v1/sessions/${sessionId}/commit`);
  }

  /**
   * 获取后台任务状态
   * @param taskId 任务 ID
   * @returns 任务状态
   */
  async getTask(taskId: string): Promise<TaskResponse> {
    return this.request<TaskResponse>('GET', `/api/v1/tasks/${taskId}`);
  }

  /**
   * 获取会话上下文
   * @param sessionId 会话 ID
   * @param tokenBudget Token 预算
   * @returns 会话上下文
   */
  async getSessionContext(sessionId: string, tokenBudget?: number): Promise<SessionContext> {
    const url = `/api/v1/sessions/${sessionId}/context${tokenBudget ? `?token_budget=${tokenBudget}` : ''}`;
    return this.request<SessionContext>('GET', url);
  }

  /**
   * 删除会话
   * @param sessionId 会话 ID
   */
  async deleteSession(sessionId: string): Promise<void> {
    await this.request('DELETE', `/api/v1/sessions/${sessionId}`);
  }

  /**
   * 列出所有会话
   * @returns 会话列表
   */
  async listSessions(): Promise<{ sessions: { id: string; created_at: string }[] }> {
    return this.request('GET', '/api/v1/sessions');
  }

  // ==================== 资源管理 API ====================

  /**
   * 添加资源
   * @param params 资源参数
   * @returns 资源 URI
   */
  async addResource(params: AddResourceParams): Promise<AddResourceResponse> {
    return this.request<AddResourceResponse>('POST', '/api/v1/resources', {
      path: params.path,
      target: params.target,
      reason: params.reason || '',
      wait: params.wait || false,
      watch_interval: params.watchInterval || 0
    });
  }

  /**
   * 读取内容
   * @param params 读取参数
   * @returns 内容
   */
  async readContent(params: ReadContentParams): Promise<ReadContentResponse> {
    const levelPath = {
      abstract: 'abstract',
      overview: 'overview',
      read: 'read'
    }[params.level];

    return this.request<ReadContentResponse>(
      'GET',
      `/api/v1/content/${levelPath}?uri=${encodeURIComponent(params.uri)}`
    );
  }

  /**
   * 获取摘要（L0）
   * @param uri 资源 URI
   * @returns 摘要内容
   */
  async abstract(uri: string): Promise<string> {
    const response = await this.readContent({ uri, level: 'abstract' });
    return response.content;
  }

  /**
   * 获取概览（L1）
   * @param uri 资源 URI
   * @returns 概览内容
   */
  async overview(uri: string): Promise<string> {
    const response = await this.readContent({ uri, level: 'overview' });
    return response.content;
  }

  /**
   * 读取完整内容（L2）
   * @param uri 资源 URI
   * @returns 完整内容
   */
  async read(uri: string): Promise<string> {
    const response = await this.readContent({ uri, level: 'read' });
    return response.content;
  }

  // ==================== 文件系统 API ====================

  /**
   * 列出目录
   * @param uri 目录 URI
   * @returns 目录内容
   */
  async ls(uri: string): Promise<{ entries: { name: string; type: string; uri: string }[] }> {
    return this.request('GET', `/api/v1/fs/ls?uri=${encodeURIComponent(uri)}`);
  }

  /**
   * 获取目录树
   * @param uri 目录 URI
   * @param depth 深度
   * @returns 目录树
   */
  async tree(uri: string, depth?: number): Promise<{ tree: string }> {
    const url = `/api/v1/fs/tree?uri=${encodeURIComponent(uri)}${depth ? `&depth=${depth}` : ''}`;
    return this.request('GET', url);
  }

  /**
   * 获取文件状态
   * @param uri 文件/目录 URI
   * @returns 状态信息
   */
  async stat(uri: string): Promise<{
    uri: string;
    type: string;
    size: number;
    created_at: string;
    modified_at: string;
  }> {
    return this.request('GET', `/api/v1/fs/stat?uri=${encodeURIComponent(uri)}`);
  }

  /**
   * 创建目录
   * @param uri 目录 URI
   */
  async mkdir(uri: string): Promise<void> {
    await this.request('POST', '/api/v1/fs/mkdir', { uri });
  }

  /**
   * 删除资源
   * @param uri 资源 URI
   */
  async rm(uri: string): Promise<void> {
    await this.request('DELETE', `/api/v1/fs/rm?uri=${encodeURIComponent(uri)}`);
  }

  /**
   * 移动资源
   * @param srcUri 源 URI
   * @param dstUri 目标 URI
   */
  async mv(srcUri: string, dstUri: string): Promise<void> {
    await this.request('POST', '/api/v1/fs/mv', {
      src_uri: srcUri,
      dst_uri: dstUri
    });
  }

  /**
   * 写入文件
   * @param uri 文件 URI
   * @param content 文件内容
   */
  async write(uri: string, content: string): Promise<void> {
    try {
      await this.request('POST', '/api/v1/content/write', {
        uri,
        content
      });
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const canFallback =
        message.includes('NOT_FOUND') ||
        message.includes('File not found') ||
        message.includes('write only supports existing files') ||
        message.includes('got directory');
      if (!canFallback) {
        throw error;
      }
    }

    const tempFileId = await this.uploadTempTextFile(this.getFileNameFromUri(uri), content);
    await this.request('POST', '/api/v1/resources', {
      temp_file_id: tempFileId,
      to: uri,
      wait: true
    });
  }

  // ==================== 健康检查 ====================

  /**
   * 检查服务健康状态
   * @returns 是否健康
   */
  async healthCheck(): Promise<boolean> {
    for (const path of ['/api/v1/health', '/health']) {
      try {
        const response = await this.request<{ status?: string }>('GET', path);
        if (response.status === 'ok' || response.status === 'healthy') {
          return true;
        }
      } catch {}
    }
    return false;
  }
}

/**
 * 创建 OpenViking 客户端实例
 */
export function createOpenVikingClient(config: OpenVikingConfig): OpenVikingClient {
  return new OpenVikingClient(config);
}
