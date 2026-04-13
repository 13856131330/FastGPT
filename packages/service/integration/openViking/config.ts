/**
 * OpenViking 配置管理
 * 从 FastGPT 全局配置中加载 OpenViking 配置
 */

import type { OpenVikingConfigType } from '@fastgpt/global/common/system/types/index';
import type { OpenVikingConfig } from '@fastgpt/global/integration/openViking/type';
import { OpenVikingClient } from './OpenVikingClient';
import { OpenVikingSessionManager } from './SessionManager';
import { OpenVikingRelationBuilder } from './RelationBuilder';
import { OpenVikingSearchService } from './SearchService';

/**
 * 从全局配置获取 OpenViking 配置
 */
export function getOpenVikingConfig(): OpenVikingConfigType | undefined {
  return global.openVikingConfig;
}

/**
 * 设置全局 OpenViking 配置
 */
export function setOpenVikingConfig(config: OpenVikingConfigType): void {
  global.openVikingConfig = config;
}

/**
 * 检查 OpenViking 是否启用
 */
export function isOpenVikingEnabled(): boolean {
  const config = getOpenVikingConfig();
  return config?.enabled === true;
}

/**
 * 创建 OpenViking 客户端配置
 */
export function createOpenVikingClientConfig(): OpenVikingConfig | null {
  const config = getOpenVikingConfig();
  if (!config || !config.enabled) {
    return null;
  }

  return {
    endpoint: config.endpoint,
    apiKey: config.apiKey,
    timeout: config.timeout || 30000,
    enabled: config.enabled
  };
}

// 共享的客户端实例
let sharedClient: OpenVikingClient | null = null;

/**
 * 获取或创建共享的 OpenViking 客户端实例
 */
export function getSharedOpenVikingClient(): OpenVikingClient | null {
  if (sharedClient) {
    return sharedClient;
  }

  const config = createOpenVikingClientConfig();
  if (!config) {
    return null;
  }

  sharedClient = new OpenVikingClient(config);
  return sharedClient;
}

/**
 * 创建会话管理器
 */
export function createOpenVikingSessionManager(
  sessionId?: string
): OpenVikingSessionManager | null {
  const client = getSharedOpenVikingClient();
  if (!client) {
    return null;
  }

  const config = getOpenVikingConfig();
  return new OpenVikingSessionManager({
    client,
    sessionId,
    autoCommit: config?.session?.autoCommit || false
  });
}

/**
 * 创建关联构建器
 */
export function createOpenVikingRelationBuilder(): OpenVikingRelationBuilder | null {
  const client = getSharedOpenVikingClient();
  if (!client) {
    return null;
  }

  const config = getOpenVikingConfig();
  return new OpenVikingRelationBuilder({
    client,
    autoDiscoverThreshold: config?.relation?.autoDiscoverThreshold || 0.7,
    maxRelationsPerResource: config?.relation?.maxRelationsPerResource || 5
  });
}

/**
 * 创建搜索服务
 */
export function createOpenVikingSearchService(
  sessionManager?: OpenVikingSessionManager
): OpenVikingSearchService | null {
  const client = getSharedOpenVikingClient();
  if (!client) {
    return null;
  }

  const config = getOpenVikingConfig();
  return new OpenVikingSearchService({
    client,
    sessionManager,
    defaultLimit: config?.search?.defaultLimit || 10,
    defaultScoreThreshold: config?.search?.defaultScoreThreshold || 0.5,
    includeRelations: config?.search?.includeRelations !== false,
    maxRelationsPerResult: config?.search?.maxRelationsPerResult || 3
  });
}

/**
 * 初始化 OpenViking 集成
 * 在系统启动时调用
 */
export async function initOpenVikingIntegration(
  config: OpenVikingConfigType | undefined
): Promise<void> {
  if (!config) {
    console.log('OpenViking config not found, skipping initialization');
    return;
  }

  setOpenVikingConfig(config);

  if (!config.enabled) {
    console.log('OpenViking integration is disabled');
    return;
  }

  // 创建客户端并检查健康状态
  const client = getSharedOpenVikingClient();
  if (client) {
    try {
      const isHealthy = await client.healthCheck();
      if (isHealthy) {
        console.log('OpenViking integration initialized successfully');
      } else {
        console.warn('OpenViking service is not healthy, integration may not work properly');
      }
    } catch (error) {
      console.error('Failed to check OpenViking health:', error);
    }
  }
}

// 扩展全局类型声明
declare global {
  var openVikingConfig: OpenVikingConfigType | undefined;
}
