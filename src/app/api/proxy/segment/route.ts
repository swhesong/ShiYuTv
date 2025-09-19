/* eslint-disable no-console,@typescript-eslint/no-explicit-any */

import { NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';

export const runtime = 'nodejs';

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Type, User-Agent, Referer',
      'Access-Control-Max-Age': '86400',
    },
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  const source = searchParams.get('moontv-source');
  if (!url) {
    return NextResponse.json({ error: 'Missing url' }, { status: 400 });
  }

  const config = await getConfig();
  const liveSource = config.LiveConfig?.find((s: any) => s.key === source);
  if (!liveSource) {
    // 即使是点播，也需要源信息来获取UA，所以这里检查是必要的
    return NextResponse.json({ error: 'Source not found' }, { status: 404 });
  }
  const ua = liveSource.ua || 'AptvPlayer/1.4.10';

  let response: Response | null = null;
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  try {
    const decodedUrl = decodeURIComponent(url);

    const requestHeaders: Record<string, string> = {
      'User-Agent': ua,
      'Accept': '*/*',
      'Connection': 'keep-alive',
    };

    const range = request.headers.get('range');
    if (range) {
      requestHeaders['Range'] = range;
    }

    // --- 智能 Referer 策略 ---
    // 尝试将 Referer 设置为目标 URL 的根域名，模拟直接访问
    try {
      const urlObject = new URL(decodedUrl);
      requestHeaders['Referer'] = urlObject.origin;
    } catch {
      // 如果 URL 解析失败，则不设置 Referer
    }

    response = await fetch(decodedUrl, {
      headers: requestHeaders,
      signal: AbortSignal.timeout(60000), // 视频段超时时间更长
    });


    // 1. 恢复重要的错误检查
    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch segment from source' },
        { status: response.status }
      );
    }

    // 2. 先声明 headers 变量
    const headers = new Headers();
    // 3. 安全地复制源站的响应头    
    if (response) {
      ['content-type', 'content-length', 'content-range', 'accept-ranges'].forEach(header => {
        // Fix: Add null check within forEach callback
        if (response) {
          const value = response.headers.get(header);
          if (value) {
            headers.set(header, value);
          }
        }
      });
    }
    
    // 4. 设置默认值和CORS头
    if (!headers.has('content-type')) {
      headers.set('Content-Type', 'video/mp2t');
    }
    if (!headers.has('accept-ranges')) {
      headers.set('Accept-Ranges', 'bytes');
    }

    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Range, Content-Type, User-Agent, Referer');
    headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges, Content-Type');
    headers.set('Cache-Control', 'public, max-age=86400');

    // 使用流式传输，避免占用内存
    const stream = new ReadableStream({
      start(controller) {
        if (!response?.body) {
          controller.close();
          return;
        }

        reader = response.body.getReader();
        

        // const isCancelled = false;

        function pump() {
          // 只检查 reader 是否存在
          if (!reader) {
            return;
          }

          reader
            .read()
            .then(({ done, value }) => {
              // if (isCancelled)

              if (done) {
                controller.close();
                cleanup();
                return;
              }

              controller.enqueue(value);
              pump();
            })
            .catch((error) => {
              // if (!isCancelled)
              controller.error(error);
              cleanup();
            });
        }


        function cleanup() {
          if (reader) {
            try {
              reader.releaseLock();
            } catch (e) {
              // reader 可能已经被释放，忽略错误
            }
            reader = null;
          }
        }

        pump();
      },
      cancel() {
        // 当流被取消时，确保释放所有资源
        if (reader) {
          try {
            reader.releaseLock();
          } catch (e) {
            // reader 可能已经被释放，忽略错误
          }
          reader = null;
        }

        if (response?.body) {
          try {
            response.body.cancel();
          } catch (e) {
            // 忽略取消时的错误
          }
        }
      },
    });

    return new Response(stream, { headers });
  } catch (error) {
    // 确保在错误情况下也释放资源
    if (reader) {
      try {
        (reader as ReadableStreamDefaultReader<Uint8Array>).releaseLock();
      } catch (e) {
        // 忽略错误
      }
    }

    if (response?.body) {
      try {
        response.body.cancel();
      } catch (e) {
        // 忽略错误
      }
    }

    return NextResponse.json(
      { error: 'Failed to fetch segment' },
      { status: 500 }
    );
  }
}
