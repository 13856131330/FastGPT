/**
 * OpenViking 搜索测试 API
 * 用于测试 OpenViking 的跨文档检索能力
 */

import { authDataset } from '@fastgpt/service/support/permission/dataset/auth';
import { NextAPI } from '@/service/middleware/entry';
import { ReadPermissionVal } from '@fastgpt/global/support/permission/constant';
import { CommonErrEnum } from '@fastgpt/global/common/error/code/common';
import { type ApiRequestProps } from '@fastgpt/service/type/next';
import {
  isOpenVikingEnabled,
  getSharedOpenVikingClient,
  createOpenVikingSearchService,
  createOpenVikingSessionManager
} from '@fastgpt/service/integration/openViking';
import type { MatchedContext } from '@fastgpt/global/integration/openViking/type';

export type OpenVikingSearchTestProps = {
  /** 数据集 ID */
  datasetId: string;
  /** 搜索文本 */
  text: string;
  /** 最大结果数 */
  limit?: number;
  /** 相似度阈值 */
  scoreThreshold?: number;
  /** 是否使用关联 */
  useRelations?: boolean;
  /** 是否使用迭代检索 */
  useIterative?: boolean;
  /** 迭代检索最大次数 */
  maxIterations?: number;
};

export type OpenVikingSearchTestResponse = {
  /** 搜索结果列表 */
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
  /** 耗时 */
  duration: string;
  /** 搜索模式 */
  searchMode: 'crossDocument' | 'iterative' | 'simple';
  /** 唯一文件数（跨文档检索时） */
  uniqueFileCount?: number;
  /** 迭代次数（迭代检索时） */
  iterationCount?: number;
  /** 会话 ID（迭代检索时） */
  sessionId?: string;
};

async function handler(
  req: ApiRequestProps<OpenVikingSearchTestProps>
): Promise<OpenVikingSearchTestResponse> {
  const {
    datasetId,
    text,
    limit = 10,
    scoreThreshold = 0.5,
    useRelations = true,
    useIterative = false,
    maxIterations = 3
  } = req.body;

  // 参数验证
  if (!datasetId || !text) {
    return Promise.reject(CommonErrEnum.missingParams);
  }

  // 检查 OpenViking 是否启用
  if (!isOpenVikingEnabled()) {
    return Promise.reject(new Error('OpenViking integration is not enabled'));
  }

  const start = Date.now();

  // 权限验证
  await authDataset({
    req,
    authToken: true,
    authApiKey: true,
    datasetId,
    per: ReadPermissionVal
  });

  // 获取 OpenViking 客户端
  const client = getSharedOpenVikingClient();
  if (!client) {
    return Promise.reject(new Error('OpenViking client not available'));
  }

  // 构建 OpenViking 目标 URI
  const targetUri = `viking://resources/datasets/${datasetId}`;

  let searchResult: {
    results: OpenVikingSearchTestResponse['list'];
    searchMode: OpenVikingSearchTestResponse['searchMode'];
    uniqueFileCount?: number;
    iterationCount?: number;
    sessionId?: string;
  };

  if (useIterative) {
    // 迭代检索模式
    const sessionManager = createOpenVikingSessionManager();
    if (!sessionManager) {
      return Promise.reject(new Error('OpenViking session manager not available'));
    }
    const searchService = createOpenVikingSearchService(sessionManager);

    if (!searchService) {
      return Promise.reject(new Error('Failed to create OpenViking search service'));
    }

    const iterativeResult = await searchService.iterativeSearch(text, maxIterations, {
      targetUri,
      limit,
      scoreThreshold
    });

    searchResult = {
      results: iterativeResult.resources.map(convertMatchedContext),
      searchMode: 'iterative',
      iterationCount: iterativeResult.steps.length,
      sessionId: iterativeResult.sessionId
    };
  } else {
    // 跨文档检索模式
    const searchService = createOpenVikingSearchService();

    if (!searchService) {
      return Promise.reject(new Error('Failed to create OpenViking search service'));
    }

    const crossDocResult = await searchService.crossDocumentSearch({
      query: text,
      datasetIds: [datasetId],
      useRelations,
      limit,
      scoreThreshold
    });

    searchResult = {
      results: crossDocResult.uniqueResources.map(convertMatchedContext),
      searchMode: 'crossDocument',
      uniqueFileCount: crossDocResult.uniqueFileCount
    };
  }

  return {
    list: searchResult.results,
    duration: `${((Date.now() - start) / 1000).toFixed(3)}s`,
    searchMode: searchResult.searchMode,
    uniqueFileCount: searchResult.uniqueFileCount,
    iterationCount: searchResult.iterationCount,
    sessionId: searchResult.sessionId
  };
}

/**
 * 将 OpenViking 的 MatchedContext 转换为 API 响应格式
 */
function convertMatchedContext(ctx: MatchedContext): OpenVikingSearchTestResponse['list'][0] {
  return {
    id: ctx.uri,
    q: ctx.abstract,
    score: ctx.score,
    source: ctx.uri,
    relations: ctx.relations?.map((r) => ({
      uri: r.uri,
      reason: r.reason
    }))
  };
}

export default NextAPI(handler);
