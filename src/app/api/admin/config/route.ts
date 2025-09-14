/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { AdminConfigResult } from '@/lib/admin.types';
import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig } from '@/lib/config';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
  if (storageType === 'localstorage') {
    return NextResponse.json(
      {
        error: '不支持本地存储进行管理员配置',
      },
      { status: 400 }
    );
  }

  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo || !authInfo.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const username = authInfo.username;



  try {
    const config = await getConfig();

    // 创建一个深拷贝用于前端展示，避免污染内存缓存
    const configForFrontend = JSON.parse(JSON.stringify(config));

    // 在返回给前端前，用占位符屏蔽敏感信息
    if (configForFrontend.SiteConfig.IntelligentFilter?.options?.sightengine?.apiSecret) {
      configForFrontend.SiteConfig.IntelligentFilter.options.sightengine.apiSecret = "********";
    }
    if (configForFrontend.SiteConfig.IntelligentFilter?.options?.custom?.apiKeyValue) {
      configForFrontend.SiteConfig.IntelligentFilter.options.custom.apiKeyValue = "********";
    }
    if (configForFrontend.SiteConfig.IntelligentFilter?.options?.baidu?.secretKey) {
      configForFrontend.SiteConfig.IntelligentFilter.options.baidu.secretKey = "********";
    }

    const result: AdminConfigResult = {
      Role: 'owner',
      Config: configForFrontend,
    };
    if (username === process.env.USERNAME) {
      result.Role = 'owner';
    } else {
      const user = config.UserConfig.Users.find((u) => u.username === username);
      if (user && user.role === 'admin' && !user.banned) {
        result.Role = 'admin';
      } else {
        return NextResponse.json(
          { error: '请核实您的管理员权限？' },
          { status: 401 }
        );
      }
    }

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-store', // 管理员配置不缓存
      },
    });
  } catch (error) {
    console.error('获取管理员配置失败:', error);
    return NextResponse.json(
      {
        error: '获取管理员配置失败',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
