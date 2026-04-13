/**
 * OpenViking 集成模块
 * 导出所有组件和工具
 */

// 客户端
export { OpenVikingClient, createOpenVikingClient } from './OpenVikingClient';

// 会话管理
export { OpenVikingSessionManager, createSessionManager } from './SessionManager';
export type { SessionManagerConfig, ActiveSession } from './SessionManager';

// 关联构建
export { OpenVikingRelationBuilder, createRelationBuilder } from './RelationBuilder';
export type {
  RelationBuilderConfig,
  RelationType,
  RelationRule,
  AutoDiscoverResult
} from './RelationBuilder';

// 搜索服务
export { OpenVikingSearchService, createSearchService } from './SearchService';
export type { SearchServiceConfig, RetrievalMode, DeduplicatedResult } from './SearchService';

// 数据同步
export { OpenVikingDataSyncService, createDataSyncService } from './DataSyncService';
export type {
  DataSyncServiceConfig,
  DatasetContent,
  SyncProgress,
  SyncCallback
} from './DataSyncService';

// 配置管理
export {
  getOpenVikingConfig,
  setOpenVikingConfig,
  isOpenVikingEnabled,
  createOpenVikingClientConfig,
  getSharedOpenVikingClient,
  createOpenVikingSessionManager,
  createOpenVikingRelationBuilder,
  createOpenVikingSearchService,
  initOpenVikingIntegration
} from './config';

// 重新导出类型
export type {
  OpenVikingConfig,
  FindParams,
  SearchParams,
  SearchResult,
  MatchedContext,
  LinkParams,
  Relation,
  CreateSessionResponse,
  AddMessageParams,
  UsedParams,
  CommitSessionResponse,
  TaskResponse,
  SessionContext,
  AddResourceParams,
  AddResourceResponse,
  CrossDocSearchParams,
  IterativeSearchResult,
  IterativeSearchStep,
  DatasetSyncRecord
} from '@fastgpt/global/integration/openViking/type';
