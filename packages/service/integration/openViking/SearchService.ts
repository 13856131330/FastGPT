/**
 * OpenViking 搜索服务
 * 提供跨文档检索、迭代检索和关联检索功能
 */

import type { OpenVikingClient } from './OpenVikingClient';
import type { OpenVikingSessionManager } from './SessionManager';
import type {
  SearchResult,
  MatchedContext,
  CrossDocSearchParams,
  IterativeSearchResult,
  IterativeSearchStep
} from '@fastgpt/global/integration/openViking/type';

/**
 * 搜索服务配置
 */
export type SearchServiceConfig = {
  /** OpenViking 客户端 */
  client: OpenVikingClient;
  /** 会话管理器（可选，用于迭代检索） */
  sessionManager?: OpenVikingSessionManager;
  /** 默认结果数量 */
  defaultLimit?: number;
  /** 默认相似度阈值 */
  defaultScoreThreshold?: number;
  /** 是否在结果中包含关联资源 */
  includeRelations?: boolean;
  /** 关联资源最大数量 */
  maxRelationsPerResult?: number;
};

/**
 * 检索模式
 */
export type RetrievalMode = 'simple' | 'cross_document' | 'iterative';

/**
 * 去重后的搜索结果
 */
export type DeduplicatedResult = {
  /** 唯一资源列表（按来源文件去重） */
  uniqueResources: MatchedContext[];
  /** 按文件分组的资源 */
  groupedByFile: Map<string, MatchedContext[]>;
  /** 来源文件数量 */
  uniqueFileCount: number;
  /** 总结果数量 */
  totalCount: number;
};

/**
 * OpenViking 搜索服务
 * 提供增强的检索功能，解决跨文档检索问题
 */
export class OpenVikingSearchService {
  private client: OpenVikingClient;
  private sessionManager?: OpenVikingSessionManager;
  private defaultLimit: number;
  private defaultScoreThreshold: number;
  private includeRelations: boolean;
  private maxRelationsPerResult: number;

  constructor(config: SearchServiceConfig) {
    this.client = config.client;
    this.sessionManager = config.sessionManager;
    this.defaultLimit = config.defaultLimit || 10;
    this.defaultScoreThreshold = config.defaultScoreThreshold || 0.5;
    this.includeRelations = config.includeRelations !== false;
    this.maxRelationsPerResult = config.maxRelationsPerResult || 3;
  }

  /**
   * 基本搜索
   * @param query 查询字符串
   * @param options 搜索选项
   */
  async search(
    query: string,
    options?: {
      targetUri?: string;
      limit?: number;
      scoreThreshold?: number;
      sessionId?: string;
    }
  ): Promise<SearchResult> {
    const params = {
      query,
      targetUri: options?.targetUri,
      limit: options?.limit || this.defaultLimit,
      scoreThreshold: options?.scoreThreshold || this.defaultScoreThreshold,
      sessionId: options?.sessionId
    };

    // 如果有会话 ID，使用上下文感知搜索
    if (params.sessionId) {
      return this.client.search(params);
    }

    return this.client.find(params);
  }

  /**
   * 跨文档检索
   * 优化检索结果，确保结果来自不同文件
   * @param params 搜索参数
   */
  async crossDocumentSearch(params: CrossDocSearchParams): Promise<DeduplicatedResult> {
    // 执行搜索
    const searchResult = await this.search(params.query, {
      targetUri: params.targetUri || this.buildTargetUri(params.datasetIds),
      limit: (params.limit || this.defaultLimit) * 2, // 获取更多结果以便去重
      scoreThreshold: params.scoreThreshold || this.defaultScoreThreshold,
      sessionId: params.sessionId
    });

    // 去重并按文件分组
    return this.deduplicateByFile(searchResult.resources);
  }

  /**
   * 迭代检索
   * 实现多轮检索，每轮基于上一轮结果继续检索
   * @param query 初始查询
   * @param maxIterations 最大迭代次数
   * @param options 检索选项
   */
  async iterativeSearch(
    query: string,
    maxIterations: number,
    options?: {
      targetUri?: string;
      limit?: number;
      scoreThreshold?: number;
    }
  ): Promise<IterativeSearchResult> {
    // 确保有会话管理器
    if (!this.sessionManager) {
      throw new Error('SessionManager is required for iterative search');
    }

    const sessionId = await this.sessionManager.initialize();
    const steps: IterativeSearchStep[] = [];
    const allFoundResources: MatchedContext[] = [];
    const seenUris = new Set<string>();

    // 第一次检索
    let currentQuery = query;
    for (let i = 0; i < maxIterations; i++) {
      // 添加用户查询到会话
      await this.sessionManager.addUserMessage(currentQuery);

      // 执行搜索
      const result = await this.search(currentQuery, {
        ...options,
        sessionId
      });

      // 过滤已见过的资源
      const newResources = result.resources.filter((r) => !seenUris.has(r.uri));
      newResources.forEach((r) => seenUris.add(r.uri));

      // 记录步骤
      const usedContexts = newResources
        .slice(0, options?.limit || this.defaultLimit)
        .map((r) => r.uri);
      steps.push({
        step: i + 1,
        query: currentQuery,
        foundResources: newResources,
        usedContexts
      });

      // 收集所有资源
      allFoundResources.push(...newResources);

      // 记录使用的上下文
      if (usedContexts.length > 0) {
        await this.sessionManager.recordUsedContexts(usedContexts);
      }

      // 如果没有新资源，停止迭代
      if (newResources.length === 0) {
        break;
      }

      // 生成下一轮查询（基于新发现的资源）
      if (i < maxIterations - 1) {
        currentQuery = await this.generateNextQuery(newResources, currentQuery);
      }
    }

    // 添加最终回复
    await this.sessionManager.addAssistantMessage(
      `完成 ${steps.length} 轮迭代检索，找到 ${allFoundResources.length} 个资源`,
      allFoundResources.slice(0, 5).map((r) => ({ uri: r.uri, abstract: r.abstract }))
    );

    return {
      memories: [],
      resources: allFoundResources,
      skills: [],
      total: allFoundResources.length,
      steps,
      sessionId
    };
  }

  /**
   * 带关联的检索
   * 检索结果包含关联资源
   * @param query 查询字符串
   * @param options 检索选项
   */
  async searchWithRelations(
    query: string,
    options?: {
      targetUri?: string;
      limit?: number;
      scoreThreshold?: number;
      maxRelations?: number;
    }
  ): Promise<{
    primaryResults: MatchedContext[];
    relatedResults: MatchedContext[];
  }> {
    // 执行主搜索
    const result = await this.search(query, options);

    // 收集关联资源
    const relatedUris = new Set<string>();
    const primaryUris = new Set(result.resources.map((r) => r.uri));

    // 从主要结果中收集关联
    for (const resource of result.resources) {
      if (resource.relations) {
        for (const relation of resource.relations.slice(
          0,
          options?.maxRelations || this.maxRelationsPerResult
        )) {
          if (!primaryUris.has(relation.uri)) {
            relatedUris.add(relation.uri);
          }
        }
      }
    }

    // 获取关联资源的详情
    const relatedResults: MatchedContext[] = [];
    for (const uri of relatedUris) {
      try {
        const abstract = await this.client.abstract(uri);
        relatedResults.push({
          uri,
          contextType: 'RESOURCE',
          isLeaf: true,
          abstract,
          score: 0, // 关联资源没有搜索分数
          relations: []
        });
      } catch (error) {
        // 忽略获取失败的资源
        console.warn(`Failed to get abstract for ${uri}:`, error);
      }
    }

    return {
      primaryResults: result.resources,
      relatedResults
    };
  }

  /**
   * 混合检索
   * 结合向量搜索和全文搜索
   * @param query 查询字符串
   * @param options 检索选项
   */
  async hybridSearch(
    query: string,
    options?: {
      targetUri?: string;
      limit?: number;
      scoreThreshold?: number;
      vectorWeight?: number; // 向量搜索权重，默认 0.5
    }
  ): Promise<SearchResult> {
    const vectorWeight = options?.vectorWeight ?? 0.5;
    const limit = options?.limit || this.defaultLimit;

    // 并行执行向量搜索和模式搜索
    const [vectorResult, grepResult] = await Promise.all([
      this.client.find({
        query,
        targetUri: options?.targetUri,
        limit: limit * 2,
        scoreThreshold: options?.scoreThreshold
      }),
      options?.targetUri
        ? this.client.grep(options.targetUri, query, true)
        : Promise.resolve({ matches: [], count: 0 })
    ]);

    // 合并结果
    const uriScoreMap = new Map<string, { score: number; context: MatchedContext }>();

    // 添加向量搜索结果
    for (const ctx of vectorResult.resources) {
      uriScoreMap.set(ctx.uri, {
        score: ctx.score * vectorWeight,
        context: ctx
      });
    }

    // 添加模式搜索结果
    for (const match of grepResult.matches) {
      const existing = uriScoreMap.get(match.uri);
      if (existing) {
        // 合并分数
        existing.score += 1 - vectorWeight;
      } else {
        // 创建新的上下文
        uriScoreMap.set(match.uri, {
          score: 1 - vectorWeight,
          context: {
            uri: match.uri,
            contextType: 'RESOURCE',
            isLeaf: true,
            abstract: match.content,
            score: 0,
            relations: []
          }
        });
      }
    }

    // 排序并返回
    const sortedResults = Array.from(uriScoreMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((item) => ({
        ...item.context,
        score: item.score
      }));

    return {
      memories: [],
      resources: sortedResults,
      skills: [],
      total: sortedResults.length
    };
  }

  /**
   * 带过滤的检索
   * 支持基于元数据的过滤
   * @param query 查询字符串
   * @param filters 过滤条件
   * @param options 检索选项
   */
  async filteredSearch(
    query: string,
    filters: Record<string, unknown>,
    options?: {
      targetUri?: string;
      limit?: number;
      scoreThreshold?: number;
    }
  ): Promise<SearchResult> {
    return this.client.find({
      query,
      targetUri: options?.targetUri,
      limit: options?.limit || this.defaultLimit,
      scoreThreshold: options?.scoreThreshold || this.defaultScoreThreshold,
      filter: filters
    });
  }

  // ==================== 私有方法 ====================

  /**
   * 按文件去重
   * 将结果按源文件分组，确保返回来自不同文件的结果
   */
  private deduplicateByFile(resources: MatchedContext[]): DeduplicatedResult {
    const groupedByFile = new Map<string, MatchedContext[]>();

    // 按文件分组（提取文件路径）
    for (const resource of resources) {
      const filePath = this.extractFilePath(resource.uri);
      const group = groupedByFile.get(filePath) || [];
      group.push(resource);
      groupedByFile.set(filePath, group);
    }

    // 从每个文件中选择最佳结果
    const uniqueResources: MatchedContext[] = [];
    for (const [, group] of groupedByFile) {
      // 选择分数最高的结果
      const best = group.sort((a, b) => b.score - a.score)[0];
      uniqueResources.push(best);
    }

    // 按分数排序
    uniqueResources.sort((a, b) => b.score - a.score);

    return {
      uniqueResources,
      groupedByFile,
      uniqueFileCount: groupedByFile.size,
      totalCount: resources.length
    };
  }

  /**
   * 从 URI 中提取文件路径
   */
  private extractFilePath(uri: string): string {
    const match = uri.match(/viking:\/\/(?:resources|agent)\/(.+?)(?:#|$)/);
    if (match) {
      const fullPath = match[1];
      // 如果是 chunk，提取文件路径
      const chunkIndex = fullPath.indexOf('/chunks/');
      if (chunkIndex !== -1) {
        return fullPath.substring(0, chunkIndex);
      }
      return fullPath;
    }
    return uri;
  }

  /**
   * 构建目标 URI
   * 将数据集 ID 列表转换为 OpenViking URI
   */
  private buildTargetUri(datasetIds: string[]): string {
    if (datasetIds.length === 1) {
      return `viking://resources/datasets/${datasetIds[0]}`;
    }
    return '';
  }

  /**
   * 生成下一轮迭代查询
   */
  private async generateNextQuery(
    foundResources: MatchedContext[],
    previousQuery: string
  ): Promise<string> {
    // 简单实现：基于发现的资源摘要生成查询
    if (foundResources.length === 0) {
      return previousQuery;
    }

    // 提取关键信息
    const abstracts = foundResources
      .slice(0, 3)
      .map((r) => r.abstract)
      .join(' ');

    // 这里可以使用 LLM 生成更好的查询，目前使用简单拼接
    return `${previousQuery} 相关: ${abstracts.substring(0, 100)}`;
  }
}

/**
 * 创建搜索服务
 */
export function createSearchService(config: SearchServiceConfig): OpenVikingSearchService {
  return new OpenVikingSearchService(config);
}
