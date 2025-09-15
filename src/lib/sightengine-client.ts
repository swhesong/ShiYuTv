/* eslint-disable @typescript-eslint/no-explicit-any, no-console */
import { fetch as undiciFetch, Agent } from 'undici';

interface SightengineResult {
  score: number;
  decision: 'allow' | 'block';
  timestamp: number;
}

// 使用模块级变量作为内存缓存
const cache = new Map<string, SightengineResult>();
const CACHE_TTL = 1000 * 60 * 60; // 缓存1小时

/**
 * 使用 Sightengine API 检查图片，并实现内存缓存。
 * @param imageUrl 要检查的图片 URL
 * @param config Sightengine 的配置
 * @returns {Promise<{ score: number; decision: 'allow' | 'block' | 'error'; reason: string }>} 审核结果
 */
export async function checkImageWithSightengine(
  imageUrl: string,
  config: { apiUrl: string; apiUser: string; apiSecret: string; confidence: number; timeoutMs?: number }
): Promise<{ score: number; decision: 'allow' | 'block' | 'error'; reason: string }> {
  const now = Date.now();

  // 1. 检查缓存
  const cached = cache.get(imageUrl);
  if (cached && now < cached.timestamp + CACHE_TTL) {
    console.log(`[Sightengine Client] Using cached result for: ${imageUrl}`);
    return {
      score: cached.score,
      decision: cached.decision,
      reason: `Cached result from ${new Date(cached.timestamp).toISOString()}`,
    };
  }

  // 2. 准备API请求
  const { apiUrl, apiUser, apiSecret, confidence, timeoutMs = 15000 } = config;
  // 1. 只检查关键凭证，因为 apiUrl 可以使用默认值
  if (!apiUser || !apiSecret) {
    return { score: 0, decision: 'error', reason: 'Sightengine config incomplete' };
  }

  // 2. 如果 apiUrl 为空，则使用默认的 Sightengine API 地址
  const effectiveApiUrl = apiUrl || 'https://api.sightengine.com/1.0/check.json';

  const params = new URLSearchParams({
    url: imageUrl,
    models: 'nudity-2.0',
    api_user: apiUser,
    api_secret: apiSecret,
  });

  // 3. 直接使用 effectiveApiUrl 构建最终请求
  //    注意：这里我们假设 apiUrl 已经是完整的端点，所以直接拼接参数
  const requestUrl = `${effectiveApiUrl}?${params.toString()}`;
  
  // 4. 执行API调用
  try {
    const agent = new Agent({ connectTimeout: timeoutMs });
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await undiciFetch(requestUrl, {
      method: 'GET',
      dispatcher: agent,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API returned status ${response.status}: ${errorText}`);
    }

    const result = await response.json() as any;

    if (result.status !== 'success') {
      throw new Error(result.error?.message || 'API returned non-success status');
    }

    // 5. 正确解析分数
    const nudity = result.nudity || {};
    const score = Math.max(
      nudity.sexual_activity || 0,
      nudity.sexual_display || 0,
      nudity.erotica || 0,
      nudity.suggestive || 0 // 也考虑进 gợi ý
    );

    const decision = score >= confidence ? 'block' : 'allow';

    // 6. 缓存结果
    cache.set(imageUrl, { score, decision, timestamp: now });

    return { score, decision, reason: `Moderation complete with score ${score}` };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown error during moderation';
    console.error(`[Sightengine Client] Error moderating ${imageUrl}:`, reason);
    return { score: -1, decision: 'error', reason };
  }
}
