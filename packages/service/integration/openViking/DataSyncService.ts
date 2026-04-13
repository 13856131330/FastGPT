/**
 * OpenViking 数据同步服务
 * 将 FastGPT 数据集内容同步到 OpenViking
 */

import type { OpenVikingClient } from './OpenVikingClient';
import type { DatasetSyncRecord } from '@fastgpt/global/integration/openViking/type';
import { getLogger, LogCategories } from '../../common/logger';

const logger = getLogger(LogCategories.SYSTEM);

/**
 * 数据同步服务配置
 */
export type DataSyncServiceConfig = {
  /** OpenViking 客户端 */
  client: OpenVikingClient;
  /** OpenViking 资源根目录 */
  resourceRoot?: string;
};

/**
 * 数据集内容
 */
export type DatasetContent = {
  /** 数据集 ID */
  datasetId: string;
  /** 数据集名称 */
  name: string;
  /** 集合列表 */
  collections: Array<{
    /** 集合 ID */
    id: string;
    /** 集合名称 */
    name: string;
    /** 数据块列表 */
    chunks: Array<{
      /** 数据块 ID */
      id: string;
      /** 问题文本 */
      q: string;
      /** 答案文本 */
      a?: string;
      /** 块索引 */
      index: number;
    }>;
  }>;
};

/**
 * 同步进度
 */
export type SyncProgress = {
  /** 数据集 ID */
  datasetId: string;
  /** 总集合数 */
  totalCollections: number;
  /** 已处理集合数 */
  processedCollections: number;
  /** 总数据块数 */
  totalChunks: number;
  /** 已处理数据块数 */
  processedChunks: number;
  /** 状态 */
  status: 'pending' | 'syncing' | 'completed' | 'failed';
  /** 错误信息 */
  error?: string;
};

/**
 * 同步回调
 */
export type SyncCallback = (progress: SyncProgress) => void;

/**
 * OpenViking 数据同步服务
 * 负责将 FastGPT 数据集内容同步到 OpenViking
 */
export class OpenVikingDataSyncService {
  private client: OpenVikingClient;
  private resourceRoot: string;
  private syncRecords: Map<string, DatasetSyncRecord> = new Map();

  constructor(config: DataSyncServiceConfig) {
    this.client = config.client;
    this.resourceRoot = config.resourceRoot || 'viking://resources/datasets';
  }

  private async ensureDir(uri: string): Promise<void> {
    try {
      await this.client.mkdir(uri);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('already exists')) {
        throw error;
      }
    }
  }

  /**
   * 获取数据集在 OpenViking 中的 URI
   */
  getDatasetUri(datasetId: string): string {
    return `${this.resourceRoot}/${datasetId}`;
  }

  /**
   * 获取集合在 OpenViking 中的 URI
   */
  getCollectionUri(datasetId: string, collectionId: string): string {
    return `${this.resourceRoot}/${datasetId}/collections/${collectionId}`;
  }

  /**
   * 同步数据集到 OpenViking
   * @param content 数据集内容
   * @param onProgress 进度回调
   */
  async syncDataset(
    content: DatasetContent,
    onProgress?: SyncCallback
  ): Promise<DatasetSyncRecord> {
    const { datasetId, name, collections } = content;
    const datasetUri = this.getDatasetUri(datasetId);

    const progress: SyncProgress = {
      datasetId,
      totalCollections: collections.length,
      processedCollections: 0,
      totalChunks: collections.reduce((sum, c) => sum + c.chunks.length, 0),
      processedChunks: 0,
      status: 'pending'
    };

    try {
      // 1. 创建数据集目录
      progress.status = 'syncing';
      onProgress?.(progress);

      await this.ensureDir(datasetUri);

      // 2. 创建数据集概览文件
      const datasetOverview = `# ${name}\n\n数据集 ID: ${datasetId}\n\n包含 ${collections.length} 个集合`;
      await this.client.write(`${datasetUri}/README.md`, datasetOverview);

      // 3. 同步每个集合
      for (const collection of collections) {
        await this.syncCollection(datasetId, collection);
        progress.processedCollections++;
        progress.processedChunks += collection.chunks.length;
        onProgress?.(progress);
      }

      // 4. 更新同步记录
      const record: DatasetSyncRecord = {
        datasetId,
        openVikingUri: datasetUri,
        status: 'completed',
        lastSyncAt: new Date().toISOString()
      };

      this.syncRecords.set(datasetId, record);
      progress.status = 'completed';
      onProgress?.(progress);

      logger.info('Dataset synced to OpenViking', { datasetId, datasetUri });
      return record;
    } catch (error) {
      progress.status = 'failed';
      progress.error = error instanceof Error ? error.message : String(error);
      onProgress?.(progress);

      const record: DatasetSyncRecord = {
        datasetId,
        openVikingUri: datasetUri,
        status: 'failed',
        error: progress.error
      };

      this.syncRecords.set(datasetId, record);
      logger.error('Failed to sync dataset to OpenViking', { datasetId, error });
      throw error;
    }
  }

  /**
   * 同步单个集合
   */
  private async syncCollection(
    datasetId: string,
    collection: DatasetContent['collections'][0]
  ): Promise<void> {
    const collectionUri = this.getCollectionUri(datasetId, collection.id);

    // 创建集合目录
    await this.ensureDir(collectionUri);

    // 为每个数据块创建文件
    for (const chunk of collection.chunks) {
      const chunkFileName = `chunk_${chunk.index.toString().padStart(5, '0')}.md`;
      const chunkUri = `${collectionUri}/${chunkFileName}`;

      // 构建内容
      let content = `# ${chunk.q}\n\n`;
      if (chunk.a) {
        content += `${chunk.a}\n\n`;
      }
      content += `\n---\nChunk ID: ${chunk.id}\nIndex: ${chunk.index}`;

      await this.client.write(chunkUri, content);
    }

    // 创建集合概览
    const collectionOverview = `# ${collection.name}\n\n集合 ID: ${collection.id}\n\n包含 ${collection.chunks.length} 个数据块`;
    await this.client.write(`${collectionUri}/README.md`, collectionOverview);
  }

  /**
   * 增量同步数据块
   * @param datasetId 数据集 ID
   * @param collectionId 集合 ID
   * @param chunks 新增或更新的数据块
   */
  async syncChunks(
    datasetId: string,
    collectionId: string,
    chunks: DatasetContent['collections'][0]['chunks']
  ): Promise<void> {
    const collectionUri = this.getCollectionUri(datasetId, collectionId);

    // 确保集合目录存在（直接尝试创建，如果已存在则忽略错误）
    await this.ensureDir(collectionUri);

    // 同步数据块
    for (const chunk of chunks) {
      const chunkFileName = `chunk_${chunk.index.toString().padStart(5, '0')}.md`;
      const chunkUri = `${collectionUri}/${chunkFileName}`;

      let content = `# ${chunk.q}\n\n`;
      if (chunk.a) {
        content += `${chunk.a}\n\n`;
      }
      content += `\n---\nChunk ID: ${chunk.id}\nIndex: ${chunk.index}`;

      await this.client.write(chunkUri, content);
    }
  }

  /**
   * 删除数据集同步
   */
  async removeDataset(datasetId: string): Promise<void> {
    const datasetUri = this.getDatasetUri(datasetId);

    try {
      await this.client.rm(datasetUri);
      this.syncRecords.delete(datasetId);
      logger.info('Removed dataset from OpenViking', { datasetId, datasetUri });
    } catch (error) {
      logger.error('Failed to remove dataset from OpenViking', { datasetId, error });
      throw error;
    }
  }

  /**
   * 删除集合同步
   */
  async removeCollection(datasetId: string, collectionId: string): Promise<void> {
    const collectionUri = this.getCollectionUri(datasetId, collectionId);

    try {
      await this.client.rm(collectionUri);
      logger.info('Removed collection from OpenViking', { datasetId, collectionId });
    } catch (error) {
      logger.error('Failed to remove collection from OpenViking', {
        datasetId,
        collectionId,
        error
      });
      throw error;
    }
  }

  /**
   * 获取同步记录
   */
  getSyncRecord(datasetId: string): DatasetSyncRecord | undefined {
    return this.syncRecords.get(datasetId);
  }

  /**
   * 获取所有同步记录
   */
  getAllSyncRecords(): DatasetSyncRecord[] {
    return Array.from(this.syncRecords.values());
  }

  /**
   * 检查数据集是否已同步
   */
  isDatasetSynced(datasetId: string): boolean {
    const record = this.syncRecords.get(datasetId);
    return record?.status === 'completed';
  }

  /**
   * 批量同步数据集
   */
  async syncDatasets(
    datasets: DatasetContent[],
    onProgress?: (datasetId: string, progress: SyncProgress) => void
  ): Promise<DatasetSyncRecord[]> {
    const results: DatasetSyncRecord[] = [];

    for (const dataset of datasets) {
      const record = await this.syncDataset(dataset, (progress) => {
        onProgress?.(dataset.datasetId, progress);
      });
      results.push(record);
    }

    return results;
  }
}

/**
 * 创建数据同步服务
 */
export function createDataSyncService(config: DataSyncServiceConfig): OpenVikingDataSyncService {
  return new OpenVikingDataSyncService(config);
}
