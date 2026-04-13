import type { SubPlanType } from '../../../support/wallet/sub/type';
import { StandSubPlanLevelMapType } from '../../../support/wallet/sub/type';
import type {
  LLMModelItemType,
  EmbeddingModelItemType,
  TTSModelType,
  STTModelType,
  RerankModelItemType
} from '../../../core/ai/model.schema';
import { SubTypeEnum } from '../../../support/wallet/sub/constants';

export type NavbarItemType = {
  id: string;
  name: string;
  avatar: string;
  url: string;
  isActive: boolean;
};

export type ExternalProviderWorkflowVarType = {
  name: string;
  key: string;
  intro: string;
  isOpen: boolean;
  url?: string;
};

/* OpenViking 配置类型 */
export type OpenVikingConfigType = {
  /** 是否启用 OpenViking 集成 */
  enabled: boolean;
  /** OpenViking 服务端点 */
  endpoint: string;
  /** API 密钥（可选） */
  apiKey?: string;
  /** 请求超时时间（毫秒） */
  timeout?: number;
  /** 搜索配置 */
  search?: {
    /** 默认返回结果数 */
    defaultLimit?: number;
    /** 默认相似度阈值 */
    defaultScoreThreshold?: number;
    /** 是否在结果中包含关联资源 */
    includeRelations?: boolean;
    /** 每个结果最大关联数 */
    maxRelationsPerResult?: number;
  };
  /** 关联配置 */
  relation?: {
    /** 自动发现关联的相似度阈值 */
    autoDiscoverThreshold?: number;
    /** 每个资源最大关联数 */
    maxRelationsPerResource?: number;
  };
  /** 会话配置 */
  session?: {
    /** 是否自动提交会话 */
    autoCommit?: boolean;
  };
};

/* fastgpt main */
export type FastGPTConfigFileType = {
  feConfigs: FastGPTFeConfigsType;
  systemEnv: SystemEnvType;
  subPlans?: SubPlanType;
  /** OpenViking 集成配置 */
  openViking?: OpenVikingConfigType;

  // Abandon
  llmModels?: LLMModelItemType[];
  vectorModels?: EmbeddingModelItemType[];
  reRankModels?: RerankModelItemType[];
  audioSpeechModels?: TTSModelType[];
  whisperModel?: STTModelType;
};

export type FastGPTFeConfigsType = {
  show_workorder?: boolean;
  show_emptyChat?: boolean;
  isPlus?: boolean;
  hideChatCopyrightSetting?: boolean;
  register_method?: ['email' | 'phone' | 'sync'];
  login_method?: ['email' | 'phone']; // Attention: login method is different with oauth
  find_password_method?: ['email' | 'phone'];
  bind_notification_method?: ['email' | 'phone'];
  googleClientVerKey?: string;
  mcpServerProxyEndpoint?: string;
  chineseRedirectUrl?: string;
  botIframeUrl?: string;

  show_appStore?: boolean;
  show_git?: boolean;
  show_pay?: boolean;
  show_openai_account?: boolean;
  show_promotion?: boolean;
  show_team_chat?: boolean;
  show_compliance_copywriting?: boolean;
  show_aiproxy?: boolean;
  show_coupon?: boolean;
  show_discount_coupon?: boolean;
  showWecomConfig?: boolean;

  show_dataset_feishu?: boolean;
  show_dataset_yuque?: boolean;
  show_publish_feishu?: boolean;
  show_publish_dingtalk?: boolean;
  show_publish_wecom?: boolean;
  show_publish_offiaccount?: boolean;
  show_publish_wechat?: boolean;
  show_agent_sandbox?: boolean;

  show_dataset_enhance?: boolean;
  show_batch_eval?: boolean;

  concatMd?: string;
  docUrl?: string;
  openAPIDocUrl?: string;
  submitPluginRequestUrl?: string;
  appTemplateCourse?: string;
  customApiDomain?: string;
  customSharePageDomain?: string;

  systemTitle?: string;
  scripts?: { [key: string]: string }[];
  favicon?: string;

  sso?: {
    icon?: string;
    title?: string;
    url?: string;
    autoLogin?: boolean;
  };
  oauth?: {
    github?: string;
    google?: string;
    wechat?: string;
    microsoft?: {
      clientId?: string;
      tenantId?: string;
      customButton?: string;
    };
    wecom?: boolean;
  };
  limit?: {
    exportDatasetLimitMinutes?: number;
    websiteSyncLimitMinuted?: number;
    agentSandboxMaxEditDebug?: number;
    agentSandboxMaxSessionRuntime?: number;
  };

  uploadFileMaxAmount: number;
  uploadFileMaxSize: number; // MB
  evalFileMaxLines?: number;

  // Compute by systemEnv.customPdfParse
  showCustomPdfParse?: boolean;
  customPdfParsePrice?: number;

  lafEnv?: string;
  navbarItems?: NavbarItemType[];
  externalProviderWorkflowVariables?: ExternalProviderWorkflowVarType[];

  payConfig?: {
    wx?: boolean;
    alipay?: boolean;
    bank?: boolean;
  };
  payFormUrl?: string;
  fileUrlWhitelist?: string[];
  customDomain?: {
    enable?: boolean;
    domain?: {
      aliyun?: string;
      tencent?: string;
      volcengine?: string;
    };
  };

  ip_whitelist?: string;

  // tmp
  agentSandboxFree?: boolean;
  // Beta features
  show_skill?: boolean;
};

export type SystemEnvType = {
  openapiPrefix?: string;
  tokenWorkers: number; // token count max worker

  datasetParseMaxProcess: number;
  vectorMaxProcess: number;
  qaMaxProcess: number;
  vlmMaxProcess: number;

  hnswEfSearch: number;
  hnswMaxScanTuples: number;

  oneapiUrl?: string;
  chatApiKey?: string;

  customPdfParse?: customPdfParseType;
  fileUrlWhitelist?: string[];
  customDomain?: customDomainType;
};

export type customDomainType = {
  kc?: {
    aliyun?: string;
    tencent?: string;
    volcengine?: string;
  };
  domain?: {
    aliyun?: string;
    tencent?: string;
    volcengine?: string;
  };
  issuerServiceName?: {
    aliyun?: string;
    tencent?: string;
    volcengine?: string;
  };
  nginxServiceName?: {
    aliyun?: string;
    tencent?: string;
    volcengine?: string;
  };
};

export type customPdfParseType = {
  url?: string;
  key?: string;
  doc2xKey?: string;
  textinAppId?: string;
  textinSecretCode?: string;
  paddleOcr?: {
    jobUrl?: string;
    model?: string;
    pollIntervalMs?: number;
    timeoutMs?: number;
  };
  price?: number;
};

export type LicenseDataType = {
  startTime: string;
  expiredTime: string;
  company: string;
  description?: string; // 描述
  hosts?: string[]; // 管理端有效域名
  maxUsers?: number; // 最大用户数，不填默认不上限
  maxApps?: number; // 最大应用数，不填默认不上限
  maxDatasets?: number; // 最大数据集数，不填默认不上限
  functions: {
    sso: boolean;
    pay: boolean;
    customTemplates: boolean;
    datasetEnhance: boolean;
    batchEval: boolean;
  };
};
