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
  const apiSites = await getAvailableApiSites(authInfo.username);

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

    try {
      const results = await Promise.allSettled(searchPromises);
      const successResults = results
        .filter((result) => result.status === 'fulfilled')
        .map((result) => (result as PromiseFulfilledResult<any>).value);
      let flattenedResults = successResults.flat();
      
      if (!config.SiteConfig.DisableYellowFilter) {
        flattenedResults = flattenedResults.filter((result) => {
          const typeName = result.type_name || '';
          return !yellowWords.some((word: string) => typeName.includes(word));
        });
      }
      
      // Apply relevance scoring and filtering
      const scoredResults = flattenedResults
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
