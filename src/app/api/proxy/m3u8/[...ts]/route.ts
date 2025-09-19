import { NextRequest, NextResponse } from 'next/server';

// 辅助函数，用于解析 .m3u8 文件中的相对路径
function resolveUrl(baseUrl: string, relativePath: string): string {
  // 如果已经是完整的 URL，直接返回
  if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
    return relativePath;
  }
  // 使用 URL 构造函数进行健壮的路径解析
  return new URL(relativePath, baseUrl).href;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { ts: string[] } }
) {
  // 从动态路由 [...ts] 中重构目标 URL，这种方式可以完美处理 URL 中的特殊字符
  const targetUrl = params.ts.join('/');

  if (!targetUrl) {
    return new NextResponse('缺少目标 URL', { status: 400 });
  }

  try {
    // 伪造请求头，模拟真实浏览器访问
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent':
          request.headers.get('User-Agent') ||
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        Referer:
          request.headers.get('Referer') || new URL(targetUrl).origin,
      },
    });

    if (!response.ok) {
      return new NextResponse(
        `请求目标 URL 失败: ${response.statusText}`,
        { status: response.status }
      );
    }

    const contentType = response.headers.get('Content-Type') || '';
    const headers = new Headers(response.headers);
    // 添加 CORS 头部，允许前端跨域访问
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    headers.set('Access-Control-Allow-Headers', '*');

    // 如果是 m3u8 清单文件，需要重写其内容
    if (
      contentType.includes('application/vnd.apple.mpegurl') ||
      contentType.includes('application/x-mpegURL') ||
      targetUrl.endsWith('.m3u8')
    ) {
      let manifest = await response.text();
      const basePath = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);

      const lines = manifest.split('\n');
      const rewrittenLines = lines.map((line) => {
        const trimmedLine = line.trim();
        // 只处理非注释行，通常是 ts 文件或下一级 m3u8 文件
        if (trimmedLine && !trimmedLine.startsWith('#')) {
          const absoluteUrl = resolveUrl(basePath, trimmedLine);
          // 将 URL 重写为指向我们的代理
          return `/api/proxy/m3u8/${absoluteUrl}`;
        }
        return line;
      });

      const rewrittenManifest = rewrittenLines.join('\n');

      // 确保返回正确的 m3u8 Content-Type
      headers.set('Content-Type', 'application/vnd.apple.mpegurl');

      return new NextResponse(rewrittenManifest, { status: 200, headers });
    }

    // 对于 .ts 视频片段或其他内容，直接透传
    return new NextResponse(response.body, { status: 200, headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    return new NextResponse(`代理出错: ${message}`, { status: 500 });
  }
}
