/* eslint-disable @typescript-eslint/no-explicit-any,no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getAvailableApiSites, getCacheTime, getConfig } from '@/lib/config';
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
    const cacheTime = await getCacheTime();
    return NextResponse.json(
      { results: [] },
      {
        headers: {
          'Cache-Control': `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
          'CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
          'Vercel-CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
          'Netlify-Vary': 'query',
        },
      }
    );
  }

  const config = await getConfig();
  let apiSites = await getAvailableApiSites(authInfo.username);
  
  // 过滤掉被管理员手动禁用的源
  apiSites = apiSites.filter(site => !site.disabled);
  
  // 采纳建议：不直接过滤，而是进行智能排序
  apiSites.sort((a, b) => {
    const getPriority = (site: typeof a) => {
      if (!site.lastCheck || site.lastCheck.status === 'untested') {
        return 1; // 未测试的源，优先级中等
      }
      switch (site.lastCheck.status) {
        case 'valid':
          return 0; // 健康的源，优先级最高
        case 'no_results':
          return 1; // 能通但搜不到结果，优先级中等
        case 'invalid':
        case 'timeout':
        case 'unreachable':
          return 2; // 不健康的源，优先级最低
        default:
          return 1; // 其他情况默认为中等
      }
    };
    
    const priorityA = getPriority(a);
    const priorityB = getPriority(b);
    
    if (priorityA !== priorityB) {
      return priorityA - priorityB; // 按优先级分组
    }
    
    // 如果优先级相同（都是健康源），则按延迟排序
    if (priorityA === 0) {
      const latencyA = a.lastCheck?.latency ?? Infinity;
      const latencyB = b.lastCheck?.latency ?? Infinity;
      return latencyA - latencyB;
    }
    
    return 0; // 其他同级不改变顺序
  });

  // 添加超时控制和错误处理，避免慢接口拖累整体响应
  const searchPromises = apiSites.map((site) =>
    Promise.race([
      searchFromApi(site, query),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`${site.name} timeout`)), 20000)
      ),
    ]).catch((err) => {
      console.warn(`搜索失败 ${site.name}:`, err.message);
      return []; // 返回空数组而不是抛出错误
    })
  );

    // International leading advanced search relevance scoring algorithm
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
  
    try {
      const results = await Promise.allSettled(searchPromises);
      const successResults = results
        .filter((result) => result.status === 'fulfilled')
        .map((result) => (result as PromiseFulfilledResult<any>).value);
      let flattenedResults = successResults.flat();
      
      if (!config.SiteConfig.DisableYellowFilter) {
        flattenedResults = flattenedResults.filter((result) => {
          const typeName = result.type_name || '';
          const title = result.title || ''; // 新增：获取标题

          // 检查标题或分类名是否包含不良词汇
          const isYellow = yellowWords.some((word: string) => 
            typeName.includes(word) || title.includes(word)
          );

          return !isYellow; // 如果不是不良内容，则保留
        });
      }

      
      // Create a map for quick lookup of site health status
      const siteStatusMap = new Map(apiSites.map(site => {
        const getPriority = (s: typeof site) => {
          if (!s.lastCheck || s.lastCheck.status === 'untested') return 1;
          switch (s.lastCheck.status) {
            case 'valid': return 0;
            case 'no_results': return 1;
            case 'invalid':
            case 'timeout':
            case 'unreachable': return 2;
            default: return 1;
          }
        };
        return [site.key, getPriority(site)];
      }));

      // Apply advanced relevance scoring and intelligent filtering
      const scoredResults = flattenedResults
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
          // 1. Primary Sort: By source health status
          const priorityA = siteStatusMap.get(a.source) ?? 2; // Default to lowest priority
          const priorityB = siteStatusMap.get(b.source) ?? 2;
          if (priorityA !== priorityB) {
            return priorityA - priorityB;
          }

          // 2. Secondary Sort: By relevance score
          const scoreDiff = b.relevanceScore - a.relevanceScore;
          
          // If scores are very close (within 10%), consider tertiary factors
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
      
      flattenedResults = scoredResults;
    const cacheTime = await getCacheTime();

    if (flattenedResults.length === 0) {
      // no cache if empty
      return NextResponse.json({ results: [] }, { status: 200 });
    }

    return NextResponse.json(
      { results: flattenedResults },
      {
        headers: {
          'Cache-Control': `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
          'CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
          'Vercel-CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
          'Netlify-Vary': 'query',
        },
      }
    );
  } catch (error) {
    return NextResponse.json({ error: '搜索失败' }, { status: 500 });
  }
}
