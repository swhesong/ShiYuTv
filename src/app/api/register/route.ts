// src/app/api/register/route.ts

import bcrypt from 'bcrypt';
import { NextRequest, NextResponse } from 'next/server';

// 我们将复用相同的数据库连接帮助程序
import { db } from '@/lib/db'; 

export const runtime = 'nodejs';
// bcrypt 加密的标准计算成本
const SALT_ROUNDS = 10; 

export async function POST(req: NextRequest) {
  // 注册功能仅适用于由数据库支持的存储类型
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
  if (storageType === 'localstorage') {
    return NextResponse.json(
      { error: 'localstorage 模式不支持注册功能。' },
      { status: 403 } // 403 Forbidden
    );
  }

  try {
    const { username, password } = await req.json();

    // 1. 输入验证
    if (!username || typeof username !== 'string' || username.length < 3) {
      return NextResponse.json(
        { error: '用户名长度至少为3个字符。' },
        { status: 400 }
      );
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json(
        { error: '密码长度至少为6个字符。' },
        { status: 400 }
      );
    }
    
    // 防止注册与所有者相同的用户名
    if (username === process.env.USERNAME) {
      return NextResponse.json(
        { error: '此用户名已被保留。' },
        { status: 409 } // 409 Conflict
      );
    }

    // 2. 检查用户是否已存在
    // (这假设您有或将要创建一个 `db.userExists` 方法)
    const exists = await db.userExists(username); 
    if (exists) {
      return NextResponse.json(
        { error: '用户名已被占用。' },
        { status: 409 } // 409 Conflict
      );
    }

    // 3. 为安全起见，对密码进行哈希处理
    // 绝不能明文存储密码！
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // 4. 在数据库中创建新用户
    // (这假设您有或将要创建一个 `db.createUser` 方法)
    await db.createUser(username, passwordHash);

    return NextResponse.json(
      { ok: true, message: '用户注册成功。' },
      { status: 201 } // 201 Created
    );

  } catch (error) {
    console.error('注册 API 错误:', error);
    return NextResponse.json(
      { error: '发生内部服务器错误。' },
      { status: 500 }
    );
  }
}
