export type SourceCheckStatus =
  | 'untested'
  | 'valid'
  | 'invalid'
  | 'timeout'
  | 'no_results'
  | 'unreachable';

export interface SourceLastCheck {
  status: SourceCheckStatus;
  latency: number; // in milliseconds, -1 if not applicable
  timestamp: number; // Unix timestamp of the check
}

export interface AdminConfig {
  ConfigSubscribtion: {
    URL: string;
    AutoUpdate: boolean;
    LastCheck: string;
  };
  ConfigFile: string;
  SiteConfig: {
    SiteName: string;
    Announcement: string;
    SearchDownstreamMaxPage: number;
    SiteInterfaceCacheTime: number;
    DoubanProxyType: string;
    DoubanProxy: string;
    DoubanImageProxyType: string;
    DoubanImageProxy: string;
    DisableYellowFilter: boolean;
    FluidSearch: boolean;
    // 智能审核字段
    IntelligentFilter: {
      enabled: boolean;
      provider: 'sightengine' | 'custom'; // 当前支持的提供商
      confidence: number;
      // 不同提供商的特定配置
      options: {
        // Sightengine 的配置
        sightengine?: {
          apiUrl: string;
          apiUser: string;
          apiSecret: string;
        };
        // 自定义 API 的配置
        custom?: {
          apiUrl: string;
          apiKeyHeader: string; // 例如 'Authorization' 或 'X-Api-Key'
          apiKeyValue: string;
          // 使用 {{URL}} 作为图片地址占位符
          jsonBodyTemplate: string; // 例如 '{"image": "{{URL}}"}'
          // 新增：响应解析配置
          responseScorePath: string; // 例如: data.score 或 nudity.raw
        };
      };
    };
    EnableRegistration: boolean; // 全局注册开关
    RegistrationApproval: boolean; // 是否需要管理员审批
    MaxUsers?: number; // 最大用户数限制（可选）
    LinuxDoOAuth: OAuthConfig;
  };
  UserConfig: {
    Users: {
      username: string;
      role: 'user' | 'admin' | 'owner';
      banned?: boolean;
      status?: 'active' | 'pending' | 'rejected'; // 用户状态
      registeredAt?: number; // 注册时间戳
      enabledApis?: string[]; // 优先级高于tags限制
      tags?: string[]; // 多 tags 取并集限制
      linuxdoId?: number; // LinuxDo 用户 ID
      linuxdoUsername?: string; // LinuxDo 用户名
    }[];
    Tags?: {
      name: string;
      enabledApis: string[];
    }[];
  };
  SourceConfig: {
    key: string;
    name: string;
    api: string;
    detail?: string;
    from: 'config' | 'custom';
    disabled?: boolean;
    lastCheck?: SourceLastCheck;
  }[];
  CustomCategories: {
    name?: string;
    type: 'movie' | 'tv';
    query: string;
    from: 'config' | 'custom';
    disabled?: boolean;
  }[];
  LiveConfig?: {
    key: string;
    name: string;
    url: string; // m3u 地址
    ua?: string;
    epg?: string; // 节目单
    from: 'config' | 'custom';
    channelNumber?: number;
    disabled?: boolean;
  }[];
}

// LinuxDo OAuth2 配置
export interface OAuthConfig {
  enabled: boolean; // OAuth 登录开关
  autoRegister: boolean; // 自动注册开关
  minTrustLevel: number; // 最低信任等级限制
  defaultRole: 'user' | 'admin'; // 自动注册默认角色
  clientId: string; // OAuth 应用 ID
  clientSecret: string; // OAuth 应用密钥
  redirectUri?: string; // 自定义回调地址
  authorizeUrl: string; // 授权端点
  tokenUrl: string; // 令牌端点
  userInfoUrl: string; // 用户信息端点
}

// LinuxDo 用户信息
export interface LinuxDoUserInfo {
  id: number;
  username: string;
  name: string;
  avatar_template: string;
  active: boolean;
  trust_level: number;
  silenced: boolean;
  external_ids: unknown;
  api_key: string;
}

// OAuth 令牌响应
export interface OAuthTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  token_type: string;
}

export interface AdminConfigResult {
  Role: 'owner' | 'admin';
  Config: AdminConfig;
}

// 待审核用户类型
export interface PendingUser {
  username: string;
  registeredAt: number;
  password: string; // 存储明文密码，与主系统保持一致
}

// 注册响应类型
export interface RegisterResponse {
  success: boolean;
  message: string;
  needsApproval?: boolean;
}

// 注册统计信息
export interface RegistrationStats {
  totalUsers: number;
  maxUsers?: number;
  pendingUsers: number;
  todayRegistrations: number;
}
