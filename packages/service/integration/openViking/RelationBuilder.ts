/**
 * OpenViking 关联关系构建器
 * 用于建立和管理文档间的关联关系，支持跨文档检索
 */

import type { OpenVikingClient } from './OpenVikingClient';
import type { Relation, MatchedContext } from '@fastgpt/global/integration/openViking/type';

/**
 * 关联构建器配置
 */
export type RelationBuilderConfig = {
  /** OpenViking 客户端 */
  client: OpenVikingClient;
  /** 自动发现关联的相似度阈值 */
  autoDiscoverThreshold?: number;
  /** 每个资源最大关联数 */
  maxRelationsPerResource?: number;
};

/**
 * 关联类型
 */
export type RelationType = 'see_also' | 'reference' | 'amends' | 'supersedes' | 'related';

/**
 * 关联规则
 */
export type RelationRule = {
  /** 源 URI 模式 */
  sourcePattern: RegExp;
  /** 目标 URI 模式 */
  targetPattern: RegExp;
  /** 关联类型 */
  relationType: RelationType;
  /** 关联原因模板 */
  reasonTemplate: string;
};

/**
 * 自动发现结果
 */
export type AutoDiscoverResult = {
  /** 源 URI */
  sourceUri: string;
  /** 发现的关联 */
  relations: Array<{
    targetUri: string;
    score: number;
    reason: string;
  }>;
};

/**
 * OpenViking 关联关系构建器
 * 提供手动和自动关联发现功能
 */
export class OpenVikingRelationBuilder {
  private client: OpenVikingClient;
  private autoDiscoverThreshold: number;
  private maxRelationsPerResource: number;
  private rules: RelationRule[] = [];

  constructor(config: RelationBuilderConfig) {
    this.client = config.client;
    this.autoDiscoverThreshold = config.autoDiscoverThreshold || 0.7;
    this.maxRelationsPerResource = config.maxRelationsPerResource || 5;
  }

  /**
   * 添加关联规则
   * @param rule 关联规则
   */
  addRule(rule: RelationRule): void {
    this.rules.push(rule);
  }

  /**
   * 清除所有规则
   */
  clearRules(): void {
    this.rules = [];
  }

  /**
   * 创建单个关联
   * @param fromUri 源 URI
   * @param toUri 目标 URI
   * @param reason 关联原因
   */
  async createRelation(fromUri: string, toUri: string, reason: string): Promise<void> {
    await this.client.link({
      fromUri,
      toUris: toUri,
      reason
    });
  }

  /**
   * 批量创建关联
   * @param fromUri 源 URI
   * @param toUris 目标 URI 列表
   * @param reason 关联原因
   */
  async createRelations(fromUri: string, toUris: string[], reason: string): Promise<void> {
    if (toUris.length === 0) return;

    await this.client.link({
      fromUri,
      toUris,
      reason
    });
  }

  /**
   * 获取资源的所有关联
   * @param uri 资源 URI
   */
  async getRelations(uri: string): Promise<Relation[]> {
    return this.client.getRelations(uri);
  }

  /**
   * 删除关联
   * @param fromUri 源 URI
   * @param toUri 目标 URI
   */
  async removeRelation(fromUri: string, toUri: string): Promise<void> {
    await this.client.unlink(fromUri, toUri);
  }

  /**
   * 基于相似度自动发现关联
   * 通过搜索相似资源来自动建立关联
   * @param sourceUri 源资源 URI
   * @param searchQuery 搜索查询（可选，默认使用源资源的摘要）
   * @param targetUriPrefix 目标 URI 前缀（限制搜索范围）
   */
  async autoDiscoverRelations(
    sourceUri: string,
    searchQuery?: string,
    targetUriPrefix?: string
  ): Promise<AutoDiscoverResult> {
    // 如果没有提供搜索查询，使用源资源的摘要
    let query = searchQuery;
    if (!query) {
      try {
        query = await this.client.abstract(sourceUri);
      } catch {
        // 如果无法获取摘要，使用 URI 的最后部分
        query = sourceUri.split('/').pop() || sourceUri;
      }
    }

    // 搜索相似资源
    const results = await this.client.find({
      query,
      targetUri: targetUriPrefix,
      limit: this.maxRelationsPerResource * 2, // 获取更多结果以便过滤
      scoreThreshold: this.autoDiscoverThreshold
    });

    // 过滤掉自身，并限制数量
    const relations: AutoDiscoverResult['relations'] = [];
    for (const ctx of results.resources) {
      if (ctx.uri === sourceUri) continue;
      if (relations.length >= this.maxRelationsPerResource) break;

      relations.push({
        targetUri: ctx.uri,
        score: ctx.score,
        reason: `自动发现：相似度 ${ctx.score.toFixed(2)}`
      });
    }

    return {
      sourceUri,
      relations
    };
  }

  /**
   * 批量自动发现并创建关联
   * @param sourceUris 源资源 URI 列表
   * @param targetUriPrefix 目标 URI 前缀
   */
  async batchAutoDiscoverAndLink(
    sourceUris: string[],
    targetUriPrefix?: string
  ): Promise<AutoDiscoverResult[]> {
    const results: AutoDiscoverResult[] = [];

    for (const sourceUri of sourceUris) {
      const discoverResult = await this.autoDiscoverRelations(
        sourceUri,
        undefined,
        targetUriPrefix
      );
      results.push(discoverResult);

      // 创建关联
      if (discoverResult.relations.length > 0) {
        await this.createRelations(
          sourceUri,
          discoverResult.relations.map((r) => r.targetUri),
          '自动发现的关联'
        );
      }
    }

    return results;
  }

  /**
   * 基于规则构建关联
   * 根据预定义的规则自动建立关联
   * @param allUris 所有资源 URI 列表
   */
  async buildRelationsByRules(allUris: string[]): Promise<void> {
    for (const sourceUri of allUris) {
      for (const rule of this.rules) {
        if (!rule.sourcePattern.test(sourceUri)) continue;

        // 查找匹配目标模式的 URI
        const matchingTargets = allUris.filter(
          (uri) => uri !== sourceUri && rule.targetPattern.test(uri)
        );

        if (matchingTargets.length > 0) {
          // 限制数量
          const limitedTargets = matchingTargets.slice(0, this.maxRelationsPerResource);

          await this.createRelations(sourceUri, limitedTargets, rule.reasonTemplate);
        }
      }
    }
  }

  /**
   * 构建双向关联
   * 在两个资源之间创建双向关联
   * @param uri1 资源 1 URI
   * @param uri2 资源 2 URI
   * @param reason 关联原因
   */
  async createBidirectionalRelation(uri1: string, uri2: string, reason: string): Promise<void> {
    await Promise.all([
      this.createRelation(uri1, uri2, reason),
      this.createRelation(uri2, uri1, reason)
    ]);
  }

  /**
   * 构建关联网络
   * 在一组资源之间创建网状关联
   * @param uris 资源 URI 列表
   * @param reason 关联原因
   */
  async buildRelationNetwork(uris: string[], reason: string): Promise<void> {
    const tasks: Promise<void>[] = [];

    for (let i = 0; i < uris.length; i++) {
      for (let j = i + 1; j < uris.length; j++) {
        tasks.push(this.createBidirectionalRelation(uris[i], uris[j], reason));
      }
    }

    await Promise.all(tasks);
  }

  /**
   * 获取扩展关联
   * 获取资源及其关联资源的关联（二度关联）
   * @param uri 资源 URI
   * @param maxDepth 最大深度
   */
  async getExtendedRelations(uri: string, maxDepth: number = 2): Promise<Map<string, Relation[]>> {
    const relationMap = new Map<string, Relation[]>();
    const visited = new Set<string>();
    const queue: Array<{ uri: string; depth: number }> = [{ uri, depth: 0 }];

    while (queue.length > 0) {
      const { uri: currentUri, depth } = queue.shift()!;

      if (visited.has(currentUri) || depth > maxDepth) continue;
      visited.add(currentUri);

      const relations = await this.getRelations(currentUri);
      if (relations.length > 0) {
        relationMap.set(currentUri, relations);
      }

      // 将关联资源加入队列
      if (depth < maxDepth) {
        for (const relation of relations) {
          if (!visited.has(relation.uri)) {
            queue.push({ uri: relation.uri, depth: depth + 1 });
          }
        }
      }
    }

    return relationMap;
  }

  /**
   * 分析关联网络
   * 返回关联网络的统计信息
   * @param rootUri 根资源 URI
   */
  async analyzeRelationNetwork(rootUri: string): Promise<{
    totalResources: number;
    totalRelations: number;
    avgRelationsPerResource: number;
    maxDepth: number;
    hubs: string[];
  }> {
    const visited = new Set<string>();
    const relationCounts = new Map<string, number>();
    const queue: Array<{ uri: string; depth: number }> = [{ uri: rootUri, depth: 0 }];
    let maxDepth = 0;

    while (queue.length > 0) {
      const { uri: currentUri, depth } = queue.shift()!;

      if (visited.has(currentUri)) continue;
      visited.add(currentUri);

      maxDepth = Math.max(maxDepth, depth);

      const relations = await this.getRelations(currentUri);
      relationCounts.set(currentUri, relations.length);

      for (const relation of relations) {
        if (!visited.has(relation.uri)) {
          queue.push({ uri: relation.uri, depth: depth + 1 });
        }
      }
    }

    const totalRelations = Array.from(relationCounts.values()).reduce(
      (sum, count) => sum + count,
      0
    );

    // 找出关联数最多的资源（中心节点）
    const sortedResources = Array.from(relationCounts.entries()).sort((a, b) => b[1] - a[1]);
    const hubs = sortedResources.slice(0, 5).map(([uri]) => uri);

    return {
      totalResources: visited.size,
      totalRelations,
      avgRelationsPerResource: visited.size > 0 ? totalRelations / visited.size : 0,
      maxDepth,
      hubs
    };
  }
}

/**
 * 创建关联构建器
 */
export function createRelationBuilder(config: RelationBuilderConfig): OpenVikingRelationBuilder {
  return new OpenVikingRelationBuilder(config);
}
