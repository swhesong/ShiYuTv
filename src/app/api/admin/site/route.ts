/* eslint-disable @typescript-eslint/no-explicit-any,no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig, setCachedConfig } from '@/lib/config';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
  if (storageType === 'localstorage') {
    return NextResponse.json(
      {
        error: '不支持本地存储进行管理员配置',
      },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();

    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const username = authInfo.username;

    const {
      SiteName,
      Announcement,
      SearchDownstreamMaxPage,
      SiteInterfaceCacheTime,
      DoubanProxyType,
      DoubanProxy,
      DoubanImageProxyType,
      DoubanImageProxy,
      DisableYellowFilter,
      FluidSearch,
      EnableRegistration,
      RegistrationApproval,
      IntelligentFilter, // 新增：从请求体中解构出 IntelligentFilter 对象
    } = body as {
      SiteName: string;
      Announcement: string;
      SearchDownstreamMaxPage: number;
      SiteInterfaceCacheTime: number;
      DoubanProxyType: string;
      DoubanProxy: string;
      DoubanImageProxyType: string;
      DoubanImageProxy: string;
      DisableYellowFilter: boolean;
      FluidSearch: boolean;
      EnableRegistration: boolean;
      RegistrationApproval: boolean;
      IntelligentFilter: any; // 新增：为 IntelligentFilter 添加类型
    };

    // 参数校验
    if (
      typeof SiteName !== 'string' ||
      typeof Announcement !== 'string' ||
      typeof SearchDownstreamMaxPage !== 'number' ||
      typeof SiteInterfaceCacheTime !== 'number' ||
      typeof DoubanProxyType !== 'string' ||
      typeof DoubanProxy !== 'string' ||
      typeof DoubanImageProxyType !== 'string' ||
      typeof DoubanImageProxy !== 'string' ||
      typeof DisableYellowFilter !== 'boolean' ||
      typeof FluidSearch !== 'boolean' ||
      typeof EnableRegistration !== 'boolean' ||
      typeof RegistrationApproval !== 'boolean' ||
      typeof IntelligentFilter !== 'object' // 新增：校验 IntelligentFilter 是一个对象
    ) {
      return NextResponse.json({ error: '参数格式错误' }, { status: 400 });
    }

    const adminConfig = await getConfig();

    // 权限校验
    if (username !== process.env.USERNAME) {
      // 管理员
      const user = adminConfig.UserConfig.Users.find(
        (u) => u.username === username
      );
      if (!user || user.role !== 'admin' || user.banned) {
        return NextResponse.json({ error: '权限不足' }, { status: 401 });
      }
    }
    
    // 日志记录：检查从前端接收到的原始参数
    if (IntelligentFilter) {
      const sightengineOpts = IntelligentFilter.options?.sightengine;
      const customOpts = IntelligentFilter.options?.custom;
      console.log('Received IntelligentFilter config from frontend:', {
        ...IntelligentFilter,
        options: {
          sightengine: {
            ...sightengineOpts,
            // 安全处理：不直接打印密钥，只打印长度信息
            apiSecret: sightengineOpts?.apiSecret 
              ? `(present, length: ${sightengineOpts.apiSecret.length})` 
              : '(not provided)',
          },
          custom: {
            ...customOpts,
            apiKeyValue: customOpts?.apiKeyValue 
              ? `(present, length: ${customOpts.apiKeyValue.length})` 
              : '(not provided)',
          },
        },
      });
    }
    
    // 安全检查：防止已保存的密钥被空值或占位符意外覆盖
    if (IntelligentFilter) {
      const sightengineOpts = IntelligentFilter.options?.sightengine;
      const customOpts = IntelligentFilter.options?.custom;
      const baiduOpts = IntelligentFilter.options?.baidu;
      // 如果前端传来的 apiSecret 是占位符，则保留数据库中已有的值
      if (sightengineOpts && sightengineOpts.apiSecret === '********') {
        console.log("Detected placeholder for apiSecret. Preserving old value.");
        sightengineOpts.apiSecret = adminConfig.SiteConfig.IntelligentFilter?.options?.sightengine?.apiSecret || '';
      }
      if (customOpts && customOpts.apiKeyValue === '********') {
        console.log("Detected placeholder for apiKeyValue. Preserving old value.");
        customOpts.apiKeyValue = adminConfig.SiteConfig.IntelligentFilter?.options?.custom?.apiKeyValue || '';
      }
      if (baiduOpts && baiduOpts.secretKey === '********') {
        baiduOpts.secretKey = adminConfig.SiteConfig.IntelligentFilter?.options?.baidu?.secretKey || '';
      }
    }

    // 更新缓存中的站点设置（保留 OAuth 配置）
    adminConfig.SiteConfig = {
      ...adminConfig.SiteConfig,
      SiteName,
      Announcement,
      SearchDownstreamMaxPage,
      SiteInterfaceCacheTime,
      DoubanProxyType,
      DoubanProxy,
      DoubanImageProxyType,
      DoubanImageProxy,
      DisableYellowFilter,
      FluidSearch,
      EnableRegistration,
      RegistrationApproval,
      IntelligentFilter, // 新增：将处理过的 IntelligentFilter 对象加入保存
    };


    // 写入数据库和缓存
    await setCachedConfig(adminConfig);
    await db.saveAdminConfig(adminConfig);

    return NextResponse.json(
      { ok: true },
      {
        headers: {
          'Cache-Control': 'no-store', // 不缓存结果
        },
      }
    );
  } catch (error) {
    console.error('更新站点配置失败:', error);
    return NextResponse.json(
      {
        error: '更新站点配置失败',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
