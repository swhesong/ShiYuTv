/* eslint-disable @typescript-eslint/no-explicit-any,no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getAvailableApiSites, getConfig } from '@/lib/config';
import { searchFromApi } from '@/lib/downstream';
import { yellowWords } from '@/lib/yellow';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo || !authInfo.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) {
    return new Response(JSON.stringify({ error: '搜索关键词不能为空' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  const config = await getConfig();
  const apiSites = await getAvailableApiSites(authInfo.username);

  // 共享状态
  let streamClosed = false;

  // 创建可读流
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      // 辅助函数：安全地向控制器写入数据
      const safeEnqueue = (data: Uint8Array) => {
        try {
          if (
            streamClosed ||
            (!controller.desiredSize && controller.desiredSize !== 0)
          ) {
            // 流已标记为关闭或控制器已关闭
            return false;
          }
          controller.enqueue(data);
          return true;
        } catch (error) {
          // 控制器已关闭或出现其他错误
          console.warn('Failed to enqueue data:', error);
          streamClosed = true;
          return false;
        }
      };

      // 发送开始事件
      const startEvent = `data: ${JSON.stringify({
        type: 'start',
        query,
        totalSources: apiSites.length,
        timestamp: Date.now(),
      })}\n\n`;

      if (!safeEnqueue(encoder.encode(startEvent))) {
        return; // 连接已关闭，提前退出
      }

      // 记录已完成的源数量
      let completedSources = 0;
      const allResults: any[] = [];

      // 为每个源创建搜索 Promise
      const searchPromises = apiSites.map(async (site) => {
        try {
          // 添加超时控制
          const searchPromise = Promise.race([
            searchFromApi(site, query),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error(`${site.name} timeout`)), 20000)
            ),
          ]);

          const results = (await searchPromise) as any[];

              // International leading advanced search relevance scoring algorithm (consistent with standard API)
              const calculateRelevanceScore = (item: any, searchQuery: string): number => {
                const query = searchQuery.toLowerCase().trim();
                const title = (item.title || '').toLowerCase();
                const typeName = (item.type_name || '').toLowerCase();
                const director = (item.director || '').toLowerCase();
                const actor = (item.actor || '').toLowerCase();
                
                let score = 0;
                const queryLength = query.length;
                const titleLength = title.length;
                
                // Advanced exact matching with weight adjustment
                if (title === query) {
                  score += 1000; // Significantly higher for exact match
                }
                // Perfect prefix matching (high priority for user intent)
                else if (title.startsWith(query)) {
                  score += 800 * (queryLength / titleLength); // Weight by query coverage
                }
                // Word boundary exact matches (important for multi-word queries)
                else if (new RegExp(`\\b${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(title)) {
                  score += 600;
                }
                // Substring matching with position weighting
                else if (title.includes(query)) {
                  const position = title.indexOf(query);
                  const positionWeight = 1 - (position / titleLength); // Earlier position gets higher score
                  score += 300 * positionWeight;
                }
                
                // Advanced multi-word query processing
                const queryWords = query.split(/\s+/).filter((word: string) => word.length > 0);
                const titleWords = title.split(/[\s-._]+/).filter((word: string) => word.length > 0);
                
                if (queryWords.length > 1) {
                  let wordMatchScore = 0;
                  let exactWordMatches = 0;
                  let partialWordMatches = 0;
                  
                  queryWords.forEach(queryWord => {
                    let bestWordScore = 0;
                    titleWords.forEach((titleWord: string) => {
                      if (titleWord === queryWord) {
                        bestWordScore = Math.max(bestWordScore, 50);
                        exactWordMatches++;
                      } else if (titleWord.includes(queryWord) && queryWord.length >= 2) {
                        const coverage = queryWord.length / titleWord.length;
                        bestWordScore = Math.max(bestWordScore, 25 * coverage);
                        partialWordMatches++;
                      } else if (queryWord.includes(titleWord) && titleWord.length >= 2) {
                        const coverage = titleWord.length / queryWord.length;
                        bestWordScore = Math.max(bestWordScore, 20 * coverage);
                      }
                    });
                    wordMatchScore += bestWordScore;
                  });
                  
                  // Bonus for matching all query words
                  if (exactWordMatches === queryWords.length) {
                    wordMatchScore *= 2;
                  }
                  
                  // Bonus for high match ratio
                  const matchRatio = (exactWordMatches + partialWordMatches * 0.5) / queryWords.length;
                  wordMatchScore *= (0.5 + matchRatio);
                  
                  score += wordMatchScore;
                }
                
                // Enhanced metadata matching
                let metadataScore = 0;
                if (typeName.includes(query)) {
                  metadataScore += 40;
                }
                if (director.includes(query)) {
                  metadataScore += 60; // Director matches are quite relevant
                }
                if (actor.includes(query)) {
                  metadataScore += 50; // Actor matches are also relevant
                }
                score += metadataScore;
                
                // Content quality and recency weighting
                const currentYear = new Date().getFullYear();
                const itemYear = parseInt(item.year) || 0;
                
                if (itemYear >= currentYear - 1) {
                  score += 30; // Very recent content
                } else if (itemYear >= currentYear - 3) {
                  score += 20; // Recent content
                } else if (itemYear >= currentYear - 10) {
                  score += 10; // Moderately recent
                }
                
                // Penalty adjustments for better relevance
                if (titleLength > queryLength * 4) {
                  score *= 0.9; // Slight penalty for very long titles
                }
                
                // Boost for concise, relevant titles
                if (titleLength <= queryLength * 2 && score > 100) {
                  score *= 1.1;
                }
                
                // Ensure minimum threshold for very weak matches
                if (score > 0 && score < 50 && !title.includes(query)) {
                  score = 0; // Filter out very weak matches
                }
                
                return Math.max(0, Math.round(score));
              };

              // Apply yellow content filter
              let filteredResults = results;
              if (!config.SiteConfig.DisableYellowFilter) {
                filteredResults = results.filter((result) => {
                  const typeName = result.type_name || '';
                  const title = result.title || ''; // 新增：获取标题

                  // 检查标题或分类名是否包含不良词汇
                  const isYellow = yellowWords.some((word: string) => 
                    typeName.includes(word) || title.includes(word)
                  );
                  
                  return !isYellow; // 如果不是不良内容，则保留
                });
              }

              // 新增：智能 AI 审核 (完全通用化)
              if (config.SiteConfig.IntelligentFilter?.enabled) {
                // 真正通用化的审核函数
                const moderateImage = async (imageUrl: string, config: any): Promise<boolean> => {
                  const filterConfig = config.SiteConfig.IntelligentFilter;
                
                  if (!filterConfig || !filterConfig.enabled || !imageUrl) {
                    return true;
                  }
                  
                  // 辅助函数：根据路径字符串安全地从对象中获取嵌套值
                  const getNestedValue = (obj: any, path: string): number | null => {
                    if (!path) return null;
                    try {
                      const value = path.split('.').reduce((o, k) => (o || {})[k], obj);
                      const num = parseFloat(value);
                      return isNaN(num) ? null : num;
                    } catch {
                      return null;
                    }
                  };
                
                  let provider: string = filterConfig.provider;
                  let requestUrl: string = '';
                  let requestOptions: RequestInit = {};
                  let scorePath: string = '';
                
                  // --- 1. 根据提供商准备请求参数 ---
                  switch (provider) {
                    case 'sightengine': {
                      const opts = filterConfig.options.sightengine;
                      if (!opts || !opts.apiUrl || !opts.apiUser || !opts.apiSecret) {
                        console.warn('[AI Filter] Sightengine is not fully configured.');
                        return true;
                      }
                      requestUrl = opts.apiUrl;
                      const formData = new FormData();
                      formData.append('api_user', opts.apiUser);
                      formData.append('api_secret', opts.apiSecret);
                      formData.append('url', imageUrl);
                      formData.append('models', 'nudity-2.0');
                      requestOptions = { method: 'POST', body: formData };
                      scorePath = 'nudity.raw'; // Sightengine 的分数路径是固定的
                      break;
                    }
                
                    case 'custom': {
                      const opts = filterConfig.options.custom;
                      if (!opts || !opts.apiUrl || !opts.apiKeyValue || !opts.apiKeyHeader || !opts.jsonBodyTemplate || !opts.responseScorePath) {
                        console.warn('[AI Filter] Custom API is not fully configured.');
                        return true;
                      }
                      try {
                        requestUrl = opts.apiUrl;
                        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                        headers[opts.apiKeyHeader] = opts.apiKeyValue;
                        const body = JSON.parse(opts.jsonBodyTemplate.replace('{{URL}}', imageUrl));
                        requestOptions = { method: 'POST', headers, body: JSON.stringify(body) };
                        scorePath = opts.responseScorePath;
                      } catch (error) {
                        console.error('[AI Filter] Failed to construct custom API request:', error);
                        return true;
                      }
                      break;
                    }
                
                    default:
                      return true; // 未知提供商
                  }
                  
                  // --- 2. 执行 API 请求并解析响应 ---
                  try {
                    const response = await fetch(requestUrl, requestOptions);
                
                    if (!response.ok) {
                      console.warn(`[AI Filter] API request for ${provider} failed with status ${response.status}.`);
                      return true;
                    }
                
                    const result = await response.json();
                    const score = getNestedValue(result, scorePath);
                    
                    if (score === null) {
                      console.warn(`[AI Filter] Could not find a valid score at path "${scorePath}" for ${provider}.`);
                      return true; // 无法解析分数，默认放行
                    }
                
                    if (score >= filterConfig.confidence) {
                      console.log(`[AI Filter] Blocked by ${provider}. Score: ${score}, Confidence: ${filterConfig.confidence}. URL: ${imageUrl}`);
                      return false; // 分数超过阈值，屏蔽
                    }
                
                    return true; // 审核通过
                  } catch (error) {
                    console.error(`[AI Filter] Exception during API call for ${provider}:`, error);
                    return true; // 发生异常，默认放行
                  }
                }
                const moderationPromises = filteredResults.map(async (item) => {
                  const isSafe = await moderateImage(item.poster, config);
                  return isSafe ? item : null;
                });
                const moderatedResults = await Promise.all(moderationPromises);
                filteredResults = moderatedResults.filter((item): item is any => item !== null);
              }
          
              // Apply advanced relevance scoring and intelligent filtering (consistent with standard API)
              const scoredResults = filteredResults
                .map(item => ({
                  ...item,
                  relevanceScore: calculateRelevanceScore(item, query)
                }))
                .filter(item => {
                  // Dynamic threshold based on query characteristics
                  const minThreshold = query.length <= 2 ? 100 : 50;
                  return item.relevanceScore >= minThreshold;
                })
                .sort((a, b) => {
                  // Multi-tier sorting for optimal relevance
                  const scoreDiff = b.relevanceScore - a.relevanceScore;
                  
                  // If scores are very close (within 10%), consider secondary factors
                  if (Math.abs(scoreDiff) <= Math.max(a.relevanceScore, b.relevanceScore) * 0.1) {
                    // Prefer exact year matches if query contains year
                    const yearMatch = query.match(/\b(19|20)\d{2}\b/);
                    if (yearMatch) {
                      const targetYear = yearMatch[0];
                      const aYearMatch = a.year === targetYear;
                      const bYearMatch = b.year === targetYear;
                      if (aYearMatch !== bYearMatch) {
                        return aYearMatch ? -1 : 1;
                      }
                    }
                    
                    // Then by recency
                    const aYear = parseInt(a.year) || 0;
                    const bYear = parseInt(b.year) || 0;
                    return bYear - aYear;
                  }
                  
                  return scoreDiff;
                });
              
              filteredResults = scoredResults;

          // 发送该源的搜索结果
          completedSources++;

          if (!streamClosed) {
            const sourceEvent = `data: ${JSON.stringify({
              type: 'source_result',
              source: site.key,
              sourceName: site.name,
              results: filteredResults,
              timestamp: Date.now(),
            })}\n\n`;

            if (!safeEnqueue(encoder.encode(sourceEvent))) {
              streamClosed = true;
              return; // 连接已关闭，停止处理
            }
          }

          if (filteredResults.length > 0) {
            allResults.push(...filteredResults);
          }
        } catch (error) {
          console.warn(`搜索失败 ${site.name}:`, error);

          // 发送源错误事件
          completedSources++;

          if (!streamClosed) {
            const errorEvent = `data: ${JSON.stringify({
              type: 'source_error',
              source: site.key,
              sourceName: site.name,
              error: error instanceof Error ? error.message : '搜索失败',
              timestamp: Date.now(),
            })}\n\n`;

            if (!safeEnqueue(encoder.encode(errorEvent))) {
              streamClosed = true;
              return; // 连接已关闭，停止处理
            }
          }
        }

        // 检查是否所有源都已完成
        if (completedSources === apiSites.length) {
          if (!streamClosed) {
            // 发送最终完成事件
            const completeEvent = `data: ${JSON.stringify({
              type: 'complete',
              totalResults: allResults.length,
              completedSources,
              timestamp: Date.now(),
            })}\n\n`;

            if (safeEnqueue(encoder.encode(completeEvent))) {
              // 只有在成功发送完成事件后才关闭流
              try {
                controller.close();
              } catch (error) {
                console.warn('Failed to close controller:', error);
              }
            }
          }
        }
      });

      // 等待所有搜索完成
      await Promise.allSettled(searchPromises);
    },

    cancel() {
      // 客户端断开连接时，标记流已关闭
      streamClosed = true;
      console.log('Client disconnected, cancelling search stream');
    },
  });

  // 返回流式响应
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
