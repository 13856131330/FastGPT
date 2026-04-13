/**
 * OpenViking 集成类型定义
 * 用于 FastGPT 与 OpenViking 服务的交互
 */

// ==================== 配置类型 ====================

/**
 * OpenViking 客户端配置
 */
export type OpenVikingConfig = {
  /** OpenViking 服务端点 */
  endpoint: string;
  /** API 密钥（可选） */
  apiKey?: string;
  /** 请求超时时间（毫秒） */
  timeout?: number;
  /** 是否启用（用于功能开关） */
  enabled?: boolean;
};

// ==================== 搜索相关类型 ====================

/**
 * 搜索模式
 */
export type SearchMode = 'embedding' | 'fullText' | 'hybrid';

/**
 * 上下文类型
 */
export type ContextType = 'RESOURCE' | 'MEMORY' | 'SKILL';

/**
 * 关联上下文
 */
export type RelatedContext = {
  /** 资源 URI */
  uri: string;
  /** 关联原因 */
  reason: string;
  /** 关联类型 */
  relationType?: string;
  /** 创建时间 */
  createdAt?: string;
};

/**
 * 匹配的上下文结果
 */
export type MatchedContext = {
  /** 资源 URI */
  uri: string;
  /** 上下文类型 */
  contextType: ContextType;
  /** 是否为叶子节点（文件） */
  isLeaf: boolean;
  /** L0 摘要 */
  abstract: string;
  /** 相关性分数 */
  score: number;
  /** 关联资源 */
  relations: RelatedContext[];
  /** 资源名称 */
  name?: string;
  /** 资源描述 */
  description?: string;
  /** 创建时间 */
  createdAt?: string;
};

/**
 * 搜索结果
 */
export type SearchResult = {
  /** 记忆上下文 */
  memories: MatchedContext[];
  /** 资源上下文 */
  resources: MatchedContext[];
  /** 技能上下文 */
  skills: MatchedContext[];
  /** 总结果数 */
  total: number;
};

/**
 * 查找请求参数
 */
export type FindParams = {
  /** 搜索查询字符串 */
  query: string;
  /** 限制搜索范围的 URI 前缀 */
  targetUri?: string;
  /** 最大返回结果数 */
  limit?: number;
  /** 最低相关性分数阈值 */
  scoreThreshold?: number;
  /** 元数据过滤器 */
  filter?: Record<string, unknown>;
};

/**
 * 搜索请求参数（带会话上下文）
 */
export type SearchParams = FindParams & {
  /** 会话 ID */
  sessionId?: string;
  /** 是否启用遥测 */
  telemetry?: boolean;
};

/**
 * 类型化查询
 */
export type TypedQuery = {
  /** 重写后的查询 */
  query: string;
  /** 上下文类型 */
  contextType: ContextType;
  /** 查询意图 */
  intent: string;
  /** 优先级 (1-5) */
  priority: number;
};

// ==================== 关联关系类型 ====================

/**
 * 创建关联请求参数
 */
export type LinkParams = {
  /** 源 URI */
  fromUri: string;
  /** 目标 URI（支持多个） */
  toUris: string | string[];
  /** 关联原因 */
  reason?: string;
};

/**
 * 关联关系
 */
export type Relation = {
  /** 资源 URI */
  uri: string;
  /** 关联原因 */
  reason: string;
  /** 关联类型 */
  relationType?: string;
  /** 创建时间 */
  createdAt?: string;
};

/**
 * 获取关联响应
 */
export type RelationsResponse = {
  status: 'ok' | 'error';
  result: Relation[];
};

// ==================== 会话管理类型 ====================

/**
 * 消息部分类型
 */
export type PartType = 'text' | 'context' | 'tool';

/**
 * 文本部分
 */
export type TextPart = {
  type: 'text';
  text: string;
};

/**
 * 上下文引用部分
 */
export type ContextPart = {
  type: 'context';
  uri: string;
  contextType: ContextType;
  abstract: string;
};

/**
 * 工具调用部分
 */
export type ToolPart = {
  type: 'tool';
  toolId: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  success?: boolean;
};

/**
 * 消息部分联合类型
 */
export type MessagePart = TextPart | ContextPart | ToolPart;

/**
 * 消息角色
 */
export type MessageRole = 'user' | 'assistant';

/**
 * 消息
 */
export type Message = {
  /** 消息 ID */
  id: string;
  /** 角色 */
  role: MessageRole;
  /** 消息部分 */
  parts: MessagePart[];
  /** 创建时间 */
  createdAt: string;
};

/**
 * 创建会话响应
 */
export type CreateSessionResponse = {
  status: 'ok' | 'error';
  session_id: string;
};

/**
 * 添加消息请求参数
 */
export type AddMessageParams = {
  /** 会话 ID */
  sessionId: string;
  /** 角色 */
  role: MessageRole;
  /** 消息部分 */
  parts?: MessagePart[];
  /** 简单文本内容 */
  content?: string;
};

/**
 * 记录上下文使用请求参数
 */
export type UsedParams = {
  /** 会话 ID */
  sessionId: string;
  /** 使用的上下文 URI */
  contexts?: string[];
  /** 使用的技能 */
  skill?: {
    uri: string;
    input: string;
    output: string;
    success: boolean;
  };
};

/**
 * 提交会话响应
 */
export type CommitSessionResponse = {
  status: 'accepted' | 'error';
  task_id: string;
  archive_uri?: string;
};

/**
 * 任务状态
 */
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';

/**
 * 任务响应
 */
export type TaskResponse = {
  status: TaskStatus;
  progress?: number;
  error?: string;
};

/**
 * 会话上下文
 */
export type SessionContext = {
  /** 最新归档概览 */
  latestArchiveOverview: string;
  /** 归档前摘要列表 */
  preArchiveAbstracts: {
    archiveId: string;
    abstract: string;
  }[];
  /** 当前活跃消息 */
  messages: Message[];
  /** 统计信息 */
  stats: {
    totalArchives: number;
    activeTokens: number;
    archiveTokens: number;
  };
};

// ==================== 资源管理类型 ====================

/**
 * 添加资源请求参数
 */
export type AddResourceParams = {
  /** 本地路径、URL 或 temp_file_id */
  path: string;
  /** 目标 URI */
  target?: string;
  /** 添加原因 */
  reason?: string;
  /** 是否等待语义处理完成 */
  wait?: boolean;
  /** 定时更新间隔（分钟） */
  watchInterval?: number;
};

/**
 * 添加资源响应
 */
export type AddResourceResponse = {
  status: 'ok' | 'error';
  root_uri: string;
  task_id?: string;
};

/**
 * 内容读取级别
 */
export type ContentLevel = 'abstract' | 'overview' | 'read';

/**
 * 读取内容请求参数
 */
export type ReadContentParams = {
  /** 资源 URI */
  uri: string;
  /** 内容级别 */
  level: ContentLevel;
};

/**
 * 读取内容响应
 */
export type ReadContentResponse = {
  status: 'ok' | 'error';
  content: string;
};

// ==================== 错误类型 ====================

/**
 * OpenViking 错误响应
 */
export type OpenVikingError = {
  status: 'error';
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

// ==================== 搜索服务类型 ====================

/**
 * 跨文档搜索参数
 */
export type CrossDocSearchParams = {
  /** 搜索查询 */
  query: string;
  /** 直接指定搜索范围 URI（优先级高于 datasetIds） */
  targetUri?: string;
  /** 数据集 ID 列表（用于映射到 OpenViking target_uri） */
  datasetIds: string[];
  /** 是否使用关联关系 */
  useRelations?: boolean;
  /** 会话 ID（用于迭代检索） */
  sessionId?: string;
  /** 最大结果数 */
  limit?: number;
  /** 相似度阈值 */
  scoreThreshold?: number;
};

/**
 * 迭代搜索步骤
 */
export type IterativeSearchStep = {
  /** 步骤序号 */
  step: number;
  /** 查询内容 */
  query: string;
  /** 找到的资源 */
  foundResources: MatchedContext[];
  /** 使用的上下文 URI */
  usedContexts: string[];
};

/**
 * 迭代搜索结果
 */
export type IterativeSearchResult = SearchResult & {
  /** 搜索步骤记录 */
  steps: IterativeSearchStep[];
  /** 会话 ID */
  sessionId: string;
};

// ==================== 适配器类型 ====================

/**
 * 数据集到 OpenViking URI 映射
 */
export type DatasetUriMapping = {
  /** FastGPT 数据集 ID */
  datasetId: string;
  /** OpenViking 资源 URI */
  openVikingUri: string;
  /** 映射创建时间 */
  createdAt: string;
};

/**
 * 同步状态
 */
export type SyncStatus = 'pending' | 'syncing' | 'completed' | 'failed';

/**
 * 数据集同步记录
 */
export type DatasetSyncRecord = {
  /** 数据集 ID */
  datasetId: string;
  /** OpenViking URI */
  openVikingUri: string;
  /** 同步状态 */
  status: SyncStatus;
  /** 最后同步时间 */
  lastSyncAt?: string;
  /** 错误信息 */
  error?: string;
};
