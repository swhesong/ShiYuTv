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

              // Advanced search relevance scoring algorithm
              const calculateRelevanceScore = (item: any, searchQuery: string): number => {
                const query = searchQuery.toLowerCase().trim();
                const title = (item.title || '').toLowerCase();
                const typeName = (item.type_name || '').toLowerCase();
                
                let score = 0;
                
                // Exact title match gets highest score
                if (title === query) {
                  score += 100;
                }
                // Title starts with query
                else if (title.startsWith(query)) {
                  score += 80;
                }
                // Title contains query as whole word
                else if (title.includes(` ${query} `) || title.includes(`${query} `) || title.includes(` ${query}`)) {
                  score += 60;
                }
                // Title contains query as substring
                else if (title.includes(query)) {
                  score += 40;
                }
                
                // Check individual keywords for partial matches
                const queryWords = query.split(/\s+/).filter(word => word.length > 0);
                const titleWords = title.split(/\s+/);
                
                queryWords.forEach(queryWord => {
                  titleWords.forEach(titleWord => {
                    if (titleWord === queryWord) {
                      score += 20;
                    } else if (titleWord.includes(queryWord) && queryWord.length >= 2) {
                      score += 10;
                    }
                  });
                });
                
                // Bonus for type name matches
                if (typeName.includes(query)) {
                  score += 15;
                }
                
                // Penalty for very long titles that might be less relevant
                if (title.length > query.length * 3) {
                  score -= 5;
                }
                
                // Bonus for recent content
                const currentYear = new Date().getFullYear();
                const itemYear = parseInt(item.year) || 0;
                if (itemYear >= currentYear - 2) {
                  score += 5;
                }
                
                return Math.max(0, score);
              };

              // Apply yellow content filter
              let filteredResults = results;
              if (!config.SiteConfig.DisableYellowFilter) {
                filteredResults = results.filter((result) => {
                  const typeName = result.type_name || '';
                  return !yellowWords.some((word: string) =>
                    typeName.includes(word)
                  );
                });
              }
              
              // Apply relevance scoring and filtering
              const scoredResults = filteredResults
                .map(item => ({
                  ...item,
                  relevanceScore: calculateRelevanceScore(item, query)
                }))
                .filter(item => item.relevanceScore >= 10) // Filter out very low relevance results
                .sort((a, b) => {
                  // Sort by relevance score first, then by year
                  if (b.relevanceScore !== a.relevanceScore) {
                    return b.relevanceScore - a.relevanceScore;
                  }
                  // If relevance scores are equal, prefer more recent content
                  const aYear = parseInt(a.year) || 0;
                  const bYear = parseInt(b.year) || 0;
                  return bYear - aYear;
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
