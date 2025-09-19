/* eslint-disable no-console,@typescript-eslint/no-explicit-any */

import { NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';

export const runtime = 'nodejs';

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, User-Agent, Referer',
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
    return NextResponse.json({ error: 'Source not found' }, { status: 404 });
  }
  const ua = liveSource.ua || 'AptvPlayer/1.4.10';

  try {
    const decodedUrl = decodeURIComponent(url);
    
    const requestHeaders: Record<string, string> = {
      'User-Agent': ua,
      'Accept': 'application/octet-stream, */*',
      'Connection': 'keep-alive',
    };
    
    const originalReferer = request.headers.get('referer');
    if (originalReferer) {
      requestHeaders['Referer'] = originalReferer;
    }

    const response = await fetch(decodedUrl, {
      headers: requestHeaders,
      signal: AbortSignal.timeout(30000),
    });
    
    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch key' },
        { status: 500 }
      );
    }
    const keyData = await response.arrayBuffer();
    const headers = new Headers();
    headers.set('Content-Type', 'application/octet-stream');
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, User-Agent, Referer');
    headers.set('Cache-Control', 'public, max-age=3600');
    headers.set('Content-Length', keyData.byteLength.toString());

    return new Response(keyData, { headers });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch key' }, { status: 500 });
  }
}
