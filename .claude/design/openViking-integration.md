# OpenViking 集成设计文档

## 概述

本文档描述了 FastGPT 与 OpenViking 的集成实现，旨在解决法律文档检索中"相关内容散落在不同文件"的问题，提升跨文件检索精度。

## 问题背景

用户在处理法律文档时面临以下挑战：
1. **文档分散**：相关内容可能散落在不同的法律条文、案例、司法解释等多个文件中
2. **检索精度不足**：传统向量搜索容易只返回同一文件的内容
3. **缺乏关联**：文档之间没有明确的父子关系，难以发现跨文件的关联内容
4. **迭代需求**：需要"检索到之后再去检索"的能力

## 解决方案

### 核心组件

#### 1. OpenVikingClient（API 客户端）

**位置**：`packages/service/integration/openViking/OpenVikingClient.ts`

**功能**：
- 封装 OpenViking HTTP API 调用
- 提供搜索、关联、会话、资源管理等接口
- 支持健康检查和错误处理

**主要方法**：
```typescript
// 搜索
find(params: FindParams): Promise<SearchResult>
search(params: SearchParams): Promise<SearchResult>

// 关联
link(params: LinkParams): Promise<void>
getRelations(uri: string): Promise<Relation[]>

// 会话
createSession(sessionId?: string): Promise<string>
addMessage(params: AddMessageParams): Promise<void>
commitSession(sessionId: string): Promise<CommitSessionResponse>

// 资源
addResource(params: AddResourceParams): Promise<AddResourceResponse>
abstract(uri: string): Promise<string>
overview(uri: string): Promise<string>
read(uri: string): Promise<string>
```

#### 2. OpenVikingSessionManager（会话管理器）

**位置**：`packages/service/integration/openViking/SessionManager.ts`

**功能**：
- 管理检索会话，支持迭代检索
- 记录上下文使用，维护检索历史
- 支持记忆提取，为后续检索提供智能推荐

**使用示例**：
```typescript
const sessionManager = new OpenVikingSessionManager({
  client: openVikingClient,
  autoCommit: false
});

// 初始化会话
await sessionManager.initialize();

// 添加用户消息
await sessionManager.addUserMessage('查找合同违约责任相关条款');

// 记录使用的上下文
await sessionManager.recordUsedContexts(['viking://resources/laws/contract/breach']);

// 提交会话，触发记忆提取
const taskId = await sessionManager.commit();
```

#### 3. OpenVikingRelationBuilder（关联构建器）

**位置**：`packages/service/integration/openViking/RelationBuilder.ts`

**功能**：
- 建立和管理文档间的关联关系
- 支持手动和自动关联发现
- 提供关联网络分析功能

**使用示例**：
```typescript
const relationBuilder = new OpenVikingRelationBuilder({
  client: openVikingClient,
  autoDiscoverThreshold: 0.7,
  maxRelationsPerResource: 5
});

// 手动建立关联
await relationBuilder.createRelations(
  'viking://resources/laws/contract/breach',
  [
    'viking://resources/cases/case-001',
    'viking://resources/interpretations/interpretation-2023'
  ],
  '违约责任相关案例和司法解释'
);

// 自动发现关联
const result = await relationBuilder.autoDiscoverRelations(
  'viking://resources/laws/contract/breach'
);
```

#### 4. OpenVikingSearchService（搜索服务）

**位置**：`packages/service/integration/openViking/SearchService.ts`

**功能**：
- 提供增强的检索功能
- 支持跨文档检索（按文件去重）
- 支持迭代检索（多轮检索）
- 支持带关联的检索

**使用示例**：
```typescript
const searchService = new OpenVikingSearchService({
  client: openVikingClient,
  sessionManager: sessionManager,
  includeRelations: true
});

// 跨文档检索
const result = await searchService.crossDocumentSearch({
  query: '合同违约责任',
  datasetIds: ['dataset-1'],
  useRelations: true
});

// 迭代检索
const iterativeResult = await searchService.iterativeSearch(
  '合同违约责任',
  3, // 最大迭代次数
  { targetUri: 'viking://resources/laws/' }
);

// 带关联的检索
const relationResult = await searchService.searchWithRelations(
  '违约金计算标准',
  { maxRelations: 5 }
);
```

### 类型定义

**位置**：`packages/global/integration/openViking/type.d.ts`

定义了所有 API 请求和响应的类型，包括：
- 配置类型（`OpenVikingConfig`）
- 搜索类型（`FindParams`, `SearchParams`, `SearchResult`, `MatchedContext`）
- 关联类型（`LinkParams`, `Relation`）
- 会话类型（`Message`, `SessionContext`）
- 资源类型（`AddResourceParams`, `AddResourceResponse`）

### 配置管理

**位置**：`packages/service/integration/openViking/config.ts`

**配置示例**（`projects/app/data/config.local.json`）：
```json
{
  "openViking": {
    "enabled": true,
    "endpoint": "http://localhost:1933",
    "apiKey": "",
    "timeout": 30000,
    "search": {
      "defaultLimit": 10,
      "defaultScoreThreshold": 0.5,
      "includeRelations": true,
      "maxRelationsPerResult": 3
    },
    "relation": {
      "autoDiscoverThreshold": 0.7,
      "maxRelationsPerResource": 5
    },
    "session": {
      "autoCommit": false
    }
  }
}
```

## 使用场景

### 场景一：跨文档法律检索

**问题**：检索"合同违约责任"，希望结果来自不同文件（法条、案例、解释）

**解决方案**：使用 `crossDocumentSearch` 方法
```typescript
const searchService = createOpenVikingSearchService();
const result = await searchService.crossDocumentSearch({
  query: '合同违约责任',
  datasetIds: ['legal-database'],
  useRelations: true
});

// result.uniqueResources - 来自不同文件的资源
// result.groupedByFile - 按文件分组的结果
// result.uniqueFileCount - 来源文件数量
```

### 场景二：迭代检索

**问题**：需要先找到一些文档，然后基于这些文档继续检索相关内容

**解决方案**：使用 `iterativeSearch` 方法
```typescript
const sessionManager = createOpenVikingSessionManager();
const searchService = createOpenVikingSearchService(sessionManager);

const result = await searchService.iterativeSearch(
  '合同违约责任',
  3, // 最多迭代 3 次
  { targetUri: 'viking://resources/' }
);

// result.steps - 每轮检索的详细信息
// result.resources - 所有找到的资源
// result.sessionId - 会话 ID，可用于后续检索
```

### 场景三：建立文档关联

**问题**：法律条文需要与相关案例、司法解释建立关联

**解决方案**：使用 `RelationBuilder`
```typescript
const relationBuilder = createOpenVikingRelationBuilder();

// 手动建立关联
await relationBuilder.createRelations(
  'viking://resources/laws/civil-code/article-577',
  [
    'viking://resources/cases/contract-breach-001',
    'viking://resources/interpretations/supreme-court-2023'
  ],
  '违约责任相关案例和司法解释'
);

// 自动发现关联
await relationBuilder.batchAutoDiscoverAndLink(
  ['viking://resources/laws/article-1', 'viking://resources/laws/article-2'],
  'viking://resources/cases/'
);
```

## 集成步骤

### 1. 部署 OpenViking 服务

```bash
docker run -d \
  --name openviking \
  -p 1933:1933 \
  -v ~/.openviking/ov.conf:/app/ov.conf \
  -v /var/lib/openviking/data:/app/data \
  ghcr.io/volcengine/openviking:main
```

### 2. 配置 FastGPT

编辑 `projects/app/data/config.local.json`，启用 OpenViking：

```json
{
  "openViking": {
    "enabled": true,
    "endpoint": "http://localhost:1933",
    "apiKey": "",
    "timeout": 30000,
    "search": {
      "defaultLimit": 10,
      "defaultScoreThreshold": 0.5,
      "includeRelations": true
    }
  }
}
```

### 3. 同步数据集到 OpenViking

使用 API 同步现有数据集：

```bash
# 同步数据集
curl -X POST http://localhost:3000/api/core/dataset/openVikingSync \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "datasetId": "YOUR_DATASET_ID",
    "mode": "full"
  }'
```

### 4. 测试 OpenViking 搜索

```bash
# 跨文档搜索
curl -X POST http://localhost:3000/api/core/dataset/openVikingSearch \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "datasetId": "YOUR_DATASET_ID",
    "text": "合同违约责任",
    "limit": 10,
    "useRelations": true
  }'

# 迭代搜索
curl -X POST http://localhost:3000/api/core/dataset/openVikingSearch \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "datasetId": "YOUR_DATASET_ID",
    "text": "合同违约责任",
    "useIterative": true,
    "maxIterations": 3
  }'
```

### 5. 在工作流中使用

可以在工作流中通过 HTTP 请求节点调用 OpenViking 搜索 API，或者扩展 datasetSearch 节点支持 OpenViking 后端。

## API 端点

### 数据同步 API

**POST /api/core/dataset/openVikingSync**

请求参数：
```typescript
{
  datasetId: string;        // 数据集 ID
  mode?: 'full' | 'incremental';  // 同步模式
  collectionIds?: string[];       // 增量同步时指定集合
}
```

响应：
```typescript
{
  status: 'started' | 'completed' | 'failed';
  record: DatasetSyncRecord;
  stats: {
    totalCollections: number;
    totalChunks: number;
    duration: number;
  };
}
```

### 搜索测试 API

**POST /api/core/dataset/openVikingSearch**

请求参数：
```typescript
{
  datasetId: string;              // 数据集 ID
  text: string;                   // 搜索文本
  limit?: number;                 // 最大结果数（默认 10）
  scoreThreshold?: number;        // 相似度阈值（默认 0.5）
  useRelations?: boolean;         // 是否使用关联（默认 true）
  useIterative?: boolean;         // 是否迭代检索（默认 false）
  maxIterations?: number;         // 迭代最大次数（默认 3）
}
```

响应：
```typescript
{
  list: Array<{
    id: string;
    q: string;
    a?: string;
    score: number;
    source: string;
    relations?: Array<{
      uri: string;
      reason: string;
    }>;
  }>;
  duration: string;
  searchMode: 'crossDocument' | 'iterative' | 'simple';
  uniqueFileCount?: number;       // 跨文档检索时的唯一文件数
  iterationCount?: number;        // 迭代检索时的迭代次数
  sessionId?: string;             // 迭代检索时的会话 ID
}
```

## 性能考虑

1. **并发控制**：客户端支持配置超时时间，避免长时间等待
2. **缓存策略**：共享客户端实例，避免重复创建
3. **增量更新**：OpenViking 支持增量更新资源，只对变化部分重新处理
4. **关联限制**：可配置每个资源的最大关联数，避免关联爆炸

## 后续优化

1. **数据同步**：实现 FastGPT 数据集到 OpenViking 资源的自动同步
2. **工作流集成**：在工作流引擎中添加 OpenViking 检索节点
3. **管理界面**：在知识库管理中添加关联关系可视化
4. **性能监控**：添加检索性能指标和监控

## 文件结构

```
packages/
├── global/
│   └── integration/
│       └── openViking/
│           ├── type.d.ts        # 类型定义
│           └── index.ts         # 导出
├── service/
│   └── integration/
│       └── openViking/
│           ├── OpenVikingClient.ts    # API 客户端
│           ├── SessionManager.ts      # 会话管理
│           ├── RelationBuilder.ts     # 关联构建
│           ├── SearchService.ts       # 搜索服务
│           ├── config.ts              # 配置管理
│           └── index.ts               # 导出

projects/app/
├── data/
│   └── config.local.json        # 配置文件
└── src/service/common/system/
    └── index.ts                 # 系统初始化（已集成）
```

## 总结

本次集成实现了 FastGPT 与 OpenViking 的基础对接，提供了：
1. ✅ OpenViking API 客户端
2. ✅ 会话管理器（支持迭代检索）
3. ✅ 关联构建器（支持跨文档关联）
4. ✅ 搜索服务（跨文档检索、迭代检索）
5. ✅ 配置管理（与 FastGPT 配置系统集成）

这些组件共同解决了用户的核心需求：提升多文件检索精度，发现散落在不同文件中的相关内容。
