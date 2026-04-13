/**
 * OpenViking 数据同步 API
 * 将 FastGPT 数据集同步到 OpenViking
 */

import { authDataset } from '@fastgpt/service/support/permission/dataset/auth';
import { NextAPI } from '@/service/middleware/entry';
import { WritePermissionVal } from '@fastgpt/global/support/permission/constant';
import { CommonErrEnum } from '@fastgpt/global/common/error/code/common';
import { type ApiRequestProps } from '@fastgpt/service/type/next';
import {
  isOpenVikingEnabled,
  getSharedOpenVikingClient,
  createDataSyncService
} from '@fastgpt/service/integration/openViking';
import { MongoDatasetData } from '@fastgpt/service/core/dataset/data/schema';
import { MongoDatasetCollection } from '@fastgpt/service/core/dataset/collection/schema';
import type { DatasetSyncRecord } from '@fastgpt/global/integration/openViking/type';

export type OpenVikingSyncProps = {
  /** 数据集 ID */
  datasetId: string;
  /** 同步模式 */
  mode?: 'full' | 'incremental';
  /** 集合 ID 列表（增量同步时） */
  collectionIds?: string[];
};

export type OpenVikingSyncResponse = {
  /** 同步状态 */
  status: 'started' | 'completed' | 'failed' | 'pending' | 'syncing';
  /** 同步记录 */
  record?: DatasetSyncRecord;
  /** 同步统计 */
  stats?: {
    /** 总集合数 */
    totalCollections: number;
    /** 总数据块数 */
    totalChunks: number;
    /** 耗时（秒） */
    duration: number;
  };
  /** 错误信息 */
  error?: string;
};

async function handler(req: ApiRequestProps<OpenVikingSyncProps>): Promise<OpenVikingSyncResponse> {
  const { datasetId, mode = 'full', collectionIds } = req.body;

  // 参数验证
  if (!datasetId) {
    return Promise.reject(CommonErrEnum.missingParams);
  }

  // 检查 OpenViking 是否启用
  if (!isOpenVikingEnabled()) {
    return Promise.reject(new Error('OpenViking integration is not enabled'));
  }

  const start = Date.now();

  // 权限验证（需要写权限）
  const { dataset, teamId } = await authDataset({
    req,
    authToken: true,
    authApiKey: true,
    datasetId,
    per: WritePermissionVal
  });

  try {
    // 获取 OpenViking 客户端
    const client = getSharedOpenVikingClient();
    if (!client) {
      throw new Error('OpenViking client not available');
    }

    // 创建数据同步服务
    const syncService = createDataSyncService({ client });

    // 从数据库获取数据集内容
    const collections = await MongoDatasetCollection.find(
      {
        teamId,
        datasetId
      },
      '_id name'
    ).lean();

    const collectionData = await Promise.all(
      collections.map(async (collection) => {
        const chunks = await MongoDatasetData.find(
          {
            teamId,
            datasetId,
            collectionId: collection._id
          },
          '_id q a chunkIndex',
          { sort: { chunkIndex: 1 } }
        ).lean();

        return {
          id: String(collection._id),
          name: collection.name,
          chunks: chunks.map((chunk) => ({
            id: String(chunk._id),
            q: chunk.q,
            a: chunk.a,
            index: chunk.chunkIndex || 0
          }))
        };
      })
    );

    // 同步到 OpenViking
    const record = await syncService.syncDataset({
      datasetId,
      name: dataset.name,
      collections: collectionData
    });

    const duration = (Date.now() - start) / 1000;

    return {
      status: record.status,
      record,
      stats: {
        totalCollections: collections.length,
        totalChunks: collectionData.reduce((sum, c) => sum + c.chunks.length, 0),
        duration
      }
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      status: 'failed',
      error: errorMessage
    };
  }
}

export default NextAPI(handler);
