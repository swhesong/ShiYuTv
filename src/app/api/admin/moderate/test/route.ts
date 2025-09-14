import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfoFromCookie } from '@/lib/auth';

export const runtime = 'nodejs';

// 智能审核API的统一测试接口
export async function POST(request: NextRequest) {
  // 1. 身份验证
  const authInfo = getAuthInfoFromCookie(request) as { role?: string };
  if (authInfo?.role !== 'owner' && authInfo?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. 解析请求体, 获取 provider 和 config
  let provider: 'sightengine' | 'custom' | 'baidu' | 'aliyun' | 'tencent';
  let config: any;
  try {
    const body = await request.json();
    provider = body.provider;
    config = body.config;
    if (!provider || !config) {
      throw new Error('缺少 provider 或 config 参数');
    }
  } catch (error) {
    return NextResponse.json({ error: '无效的请求参数' }, { status: 400 });
  }

  // 3. 根据 provider 调用不同的测试逻辑
  try {
    if (provider === 'sightengine') {
      // --- Sightengine 测试逻辑 ---
      if (!config.apiUrl || !config.apiUser || !config.apiSecret) {
        return NextResponse.json({ error: 'Sightengine 配置不完整' }, { status: 400 });
      }

      const formData = new FormData();
      formData.append('api_user', config.apiUser);
      formData.append('api_secret', config.apiSecret);
      formData.append('url', 'https://placehold.co/100x100.png'); // 使用一个公开、安全的图片URL进行测试
      formData.append('models', 'nudity-2.0');

      const testUrl = config.apiUrl.includes('/1.0/check.json') ? config.apiUrl : `${config.apiUrl.replace(/\/$/, '')}/1.0/check.json`;
      const response = await fetch(testUrl, { method: 'POST', body: formData });
      const result = await response.json();

      if (response.ok && result.status === 'success') {
        return NextResponse.json({ success: true, message: 'Sightengine 凭证有效，连接成功！' });
      } else {
        const errorMessage = result.error?.message || '凭证无效或API错误';
        throw new Error(`Sightengine 测试失败: ${errorMessage}`);
      }
    } else if (provider === 'baidu') {
      // --- 百度智能云测试逻辑 ---
      if (!config.apiKey || !config.secretKey) {
        return NextResponse.json({ error: '百度智能云配置不完整' }, { status: 400 });
      }
      
      const baseUrl = config.tokenUrl || 'https://aip.baidubce.com/oauth/2.0/token';
      const tokenUrl = `${baseUrl}?grant_type=client_credentials&client_id=${config.apiKey}&client_secret=${config.secretKey}`;
      const tokenResponse = await fetch(tokenUrl, { method: 'POST' });
      const tokenData = await tokenResponse.json();

      if (tokenResponse.ok && tokenData.access_token) {
        return NextResponse.json({ success: true, message: '百度智能云凭证有效，连接成功！' });
      } else {
        const errorMessage = tokenData.error_description || '获取 access_token 失败';
        throw new Error(`百度智能云测试失败: ${errorMessage}`);
      }
    
    } else if (provider === 'aliyun') {
      // --- 阿里云 (占位) ---
      return NextResponse.json({ error: '阿里云暂不支持测试连接' }, { status: 400 });
    
    } else if (provider === 'tencent') {
      // --- 腾讯云 (占位) ---
      return NextResponse.json({ error: '腾讯云暂不支持测试连接' }, { status: 400 });
      
    } else if (provider === 'custom') {
      // --- 自定义 API 测试逻辑 ---
      if (!config.apiUrl || !config.apiKeyValue || !config.apiKeyHeader || !config.jsonBodyTemplate) {
        return NextResponse.json({ error: '自定义 API 配置不完整' }, { status: 400 });
      }

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      headers[config.apiKeyHeader] = config.apiKeyValue;
      // 使用一个安全的占位符图片进行测试
      const imageUrl = 'https://placehold.co/100x100.png';
      const body = JSON.parse(config.jsonBodyTemplate.replace('{{URL}}', imageUrl));
      
      const response = await fetch(config.apiUrl, { method: 'POST', headers, body: JSON.stringify(body) });

      if (response.ok) {
        // 尝试解析JSON，但不强制要求，因为有些API可能返回200 OK但无内容
        try {
            await response.json();
        } catch {}
        return NextResponse.json({ success: true, message: `自定义 API 连接成功 (状态码: ${response.status})` });
      } else {
        const errorText = await response.text();
        throw new Error(`自定义 API 测试失败 (状态码: ${response.status}): ${errorText.slice(0, 150)}`);
      }

    } else {
      return NextResponse.json({ error: '不支持的 provider' }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知网络错误';
    return NextResponse.json({ error: `测试失败: ${message}` }, { status: 500 });
  }
}
