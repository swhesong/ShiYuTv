/* eslint-disable no-console, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */

import { Redis } from '@upstash/redis';
import bcrypt from 'bcrypt';

import { AdminConfig } from './admin.types';
import { Favorite, IStorage, PlayRecord, SkipConfig } from './types';

// 搜索历史最大条数
const SEARCH_HISTORY_LIMIT = 20;// 哈希加密的轮数，数值越高越安全，但耗时也越长。10 是一个比较均衡的选择。const SALT_ROUNDS = 10;// 数据类型转换辅助函数
function ensureString(value: any): string {
  return String(value);
}

function ensureStringArray(value: any[]): string[] {
  return value.map((item) => String(item));
}

// 添加Upstash Redis操作重试包装器
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (err: any) {
      const isLastAttempt = i === maxRetries - 1;      const isConnectionError =
        err.message?.includes('Connection') ||
        err.message?.includes('ECONNREFUSED') ||
        err.message?.includes('ENOTFOUND') ||
        err.code === 'ECONNRESET' ||
        err.code === 'EPIPE' ||
        err.name === 'UpstashError';

      if (isConnectionError && !isLastAttempt) {
        console.log(
          `Upstash Redis operation failed, retrying... (${i + 1}/${maxRetries})`
        );
        console.error('Error:', err.message);

        // 等待一段时间后重试
        await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
        continue;
      }

      throw err;
    }
  }

  throw new Error('Max retries exceeded');
}

export class UpstashRedisStorage implements IStorage {
  private client: Redis;

  constructor() {
    this.client = getUpstashRedisClient();
  }

  // ---------- 播放记录 (这部分代码无改动) ----------
  private prKey(user: string, key: string) {
    return `u:${user}:pr:${key}`;
  }

  async getPlayRecord(
    userName: string,    key: string
  ): Promise<PlayRecord | null> {
    const val = await withRetry(() =>
      this.client.get(this.prKey(userName, key))
    );
    return val ? (val as PlayRecord) : null;
  }

  async setPlayRecord(
    userName: string,
    key: string,
    record: PlayRecord
  ): Promise<void> {
    await withRetry(() => this.client.set(this.prKey(userName, key), record));
  }

  async getAllPlayRecords(
    userName: string
  ): Promise<Record<string, PlayRecord>> {
    const pattern = `u:${userName}:pr:*`;
    const keys: string[] = await withRetry(() => this.client.keys(pattern));
    if (keys.length === 0) return {};
    const values = await withRetry(() => this.client.mget(...keys));
    const result: Record<string, PlayRecord> = {};
    keys.forEach((fullKey: string, idx: number) => {
        const raw = values[idx];
        if (raw) {
            const rec = raw as PlayRecord;
            const keyPart = ensureString(fullKey.replace(`u:${userName}:pr:`, ''));
            result[keyPart] = rec;
        }
    });
    return result;
  }
  
  async deletePlayRecord(userName: string, key: string): Promise<void> {
    await withRetry(() => this.client.del(this.prKey(userName, key)));
  }

  // ---------- 收藏 (这部分代码无改动) ----------
  private favKey(user: string, key: string) {
    return `u:${user}:fav:${key}`;
  }

  async getFavorite(userName: string, key: string): Promise<Favorite | null> {
    const val = await withRetry(() =>
        this.client.get(this.favKey(userName, key))
    );
    return val ? (val as Favorite) : null;
  }
  
  async setFavorite(
      userName: string,
      key: string,
      favorite: Favorite
  ): Promise<void> {
      await withRetry(() =>
          this.client.set(this.favKey(userName, key), favorite)
      );
  }
  
  async getAllFavorites(userName: string): Promise<Record<string, Favorite>> {
      const pattern = `u:${userName}:fav:*`;
      const keys: string[] = await withRetry(() => this.client.keys(pattern));
      if (keys.length === 0) return {};
      const values = await withRetry(() => this.client.mget(...keys));
      const result: Record<string, Favorite> = {};
      keys.forEach((fullKey: string, idx: number) => {
          const raw = values[idx];
          if (raw) {
              const fav = raw as Favorite;
              const keyPart = ensureString(fullKey.replace(`u:${userName}:fav:`, ''));
              result[keyPart] = fav;
          }
      });
      return result;
  }
  
  async deleteFavorite(userName: string, key: string): Promise<void> {
      await withRetry(() => this.client.del(this.favKey(userName, key)));
  }

  // ---------- 用户注册 / 登录 (关键修改部分) ----------
  private userPwdKey(user: string) {
    return `u:${user}:pwd`;
  }
  
  // *** 关键修改 1: 注册时对密码进行哈希加密 ***
  async registerUser(userName: string, password: string): Promise<void> {
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    await withRetry(() => this.client.set(this.userPwdKey(userName), hashedPassword));
  }
  
  // *** 已正确实现: 登录时比较哈希值 ***
  async verifyUser(userName: string, password: string): Promise<boolean> {
    const storedHash = await withRetry(() =>
      this.client.get(this.userPwdKey(userName))
    );
    if (storedHash === null) {
      return false; // 用户不存在
    }
    return bcrypt.compare(password, String(storedHash));
  }

  // 检查用户是否存在 (无改动)
  async checkUserExist(userName: string): Promise<boolean> {
    const exists = await withRetry(() =>
      this.client.exists(this.userPwdKey(userName))
    );
    return exists === 1;
  }

  // *** 关键修改 2: 修改密码时对新密码进行哈希加密 ***
  async changePassword(userName: string, newPassword: string): Promise<void> {
    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await withRetry(() =>
      this.client.set(this.userPwdKey(userName), hashedPassword)
    );
  }

  // 删除用户及其所有数据 (无改动，但逻辑依赖keys/scan)
  async deleteUser(userName: string): Promise<void> {
    const keysToDelete: string[] = [
      this.userPwdKey(userName),
      this.shKey(userName)
    ];

    const patterns = [
      `u:${userName}:pr:*`,
      `u:${userName}:fav:*`,
      `u:${userName}:skip:*`
    ];
    
    for (const pattern of patterns) {
        let cursor = 0;
        do {
            const [nextCursor, keys] = await withRetry(() =>
                this.client.scan(cursor, { match: pattern, count: 100 })
            );
            cursor = nextCursor;
            if (keys.length > 0) {
                keysToDelete.push(...keys);
            }
        } while (cursor !== 0);
    }
    
    if (keysToDelete.length > 0) {
        await withRetry(() => this.client.del(...keysToDelete));
    }
  }


  // ---------- 搜索历史 (这部分代码无改动) ----------
  private shKey(user: string) {
    return `u:${user}:sh`;
  }

  async getSearchHistory(userName: string): Promise<string[]> {
    const result = await withRetry(() =>
      this.client.lrange(this.shKey(userName), 0, -1)
    );
    return ensureStringArray(result as any[]);
  }

  async addSearchHistory(userName: string, keyword: string): Promise<void> {
    const key = this.shKey(userName);
    await withRetry(() => this.client.lrem(key, 0, ensureString(keyword)));
    await withRetry(() => this.client.lpush(key, ensureString(keyword)));
    await withRetry(() => this.client.ltrim(key, 0, SEARCH_HISTORY_LIMIT - 1));
  }

  async deleteSearchHistory(userName: string, keyword?: string): Promise<void> {
    const key = this.shKey(userName);
    if (keyword) {
      await withRetry(() => this.client.lrem(key, 0, ensureString(keyword)));
    } else {
      await withRetry(() => this.client.del(key));
    }
  }

  // ---------- 获取全部用户 (无改动) ----------
  async getAllUsers(): Promise<string[]> {
    const keys = await withRetry(() => this.client.keys('u:*:pwd'));
    return keys
      .map((k) => {
        const match = k.match(/^u:(.+?):pwd$/);
        return match ? ensureString(match[1]) : undefined;
      })
      .filter((u): u is string => typeof u === 'string');
  }

  // ---------- 管理员配置 (无改动) ----------
  private adminConfigKey() {
    return 'admin:config';
  }

  async getAdminConfig(): Promise<AdminConfig | null> {
    const val = await withRetry(() => this.client.get(this.adminConfigKey()));
    return val ? (val as AdminConfig) : null;
  }

  async setAdminConfig(config: AdminConfig): Promise<void> {
    await withRetry(() => this.client.set(this.adminConfigKey(), config));
  }

  // ---------- 跳过片头片尾配置 (无改动) ----------
  private skipConfigKey(user: string, source: string, id: string) {
    return `u:${user}:skip:${source}+${id}`;
  }

  async getSkipConfig(
    userName: string,
    source: string,
    id: string
  ): Promise<SkipConfig | null> {
    const val = await withRetry(() =>
      this.client.get(this.skipConfigKey(userName, source, id))
    );
    return val ? (val as SkipConfig) : null;
  }

  async setSkipConfig(
    userName: string,
    source: string,
    id: string,
    config: SkipConfig
  ): Promise<void> {
    await withRetry(() =>
      this.client.set(this.skipConfigKey(userName, source, id), config)
    );
  }

  async deleteSkipConfig(
    userName: string,
    source: string,
    id: string
  ): Promise<void> {
    await withRetry(() =>
      this.client.del(this.skipConfigKey(userName, source, id))
    );
  }

  async getAllSkipConfigs(
    userName: string
  ): Promise<{ [key: string]: SkipConfig }> {
    const configs: { [key: string]: SkipConfig } = {};
    const pattern = `u:${userName}:skip:*`;
    
    let cursor = 0;
    do {
      const [nextCursor, keys] = await withRetry(() =>
        this.client.scan(cursor, { match: pattern, count: 100 })
      );
      cursor = nextCursor;

      if (keys.length > 0) {
        const values = await withRetry(() => this.client.mget(...keys));
        keys.forEach((key, index) => {
          const value = values[index];
          if (value) {
            const match = key.match(/^u:.+?:skip:(.+)$/);
            if (match) {
              const sourceAndId = match[1];
              configs[sourceAndId] = value as SkipConfig;
            }
          }
        });
      }
    } while (cursor !== 0);

    return configs;
  }

  // 清空所有数据 (无改动)
  async clearAllData(): Promise<void> {
    try {
      let cursor = 0;
      do {
        const [nextCursor, keys] = await withRetry(() =>
          this.client.scan(cursor, { count: 500 })
        );
        cursor = nextCursor;
        if (keys.length > 0) {
          await withRetry(() => this.client.del(...keys));
        }
      } while (cursor !== 0);

      console.log('所有数据已清空');
    } catch (error) {
      console.error('清空数据失败:', error);
      throw new Error('清空数据失败');
    }
  }
}

// 单例 Upstash Redis 客户端 (无改动)
function getUpstashRedisClient(): Redis {
    const globalKey = Symbol.for('__MOONTV_UPSTASH_REDIS_CLIENT__');
    let client: Redis | undefined = (global as any)[globalKey];
  
    if (!client) {
      const upstashUrl = process.env.UPSTASH_URL;
      const upstashToken = process.env.UPSTASH_TOKEN;
  
      if (!upstashUrl || !upstashToken) {
        throw new Error(
          'UPSTASH_URL and UPSTASH_TOKEN env variables must be set'
        );
      }
  
      client = new Redis({
        url: upstashUrl,
        token: upstashToken,
        retry: {
          retries: 3,
          backoff: (retryCount: number) =>
            Math.min(1000 * Math.pow(2, retryCount), 30000),
        },
      });
  
      console.log('Upstash Redis client created successfully');
  
      (global as any)[globalKey] = client;
    }
  
    return client;
  }
