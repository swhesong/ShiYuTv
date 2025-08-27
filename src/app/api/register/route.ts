// src/app/api/register/route.ts (修正版)

import bcrypt from 'bcrypt';
import { NextRequest, NextResponse } from 'next/server';

// 您的 db 实例
import { db } from '@/lib/db'; 

export const runtime = 'nodejs';
const SALT_ROUNDS = 10; 

export async function POST(req: NextRequest) {
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
  if (storageType === 'localstorage') {
    return NextResponse.json(
      { error: 'localstorage 模式不支持注册功能。' },
      { status: 403 }
    );
  }

  try {
    const { username, password } = await req.json();

    if (!username || typeof username !== 'string' || username.length < 3) {
      return NextResponse.json({ error: '用户名长度至少为3个字符。' }, { status: 400 });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json({ error: '密码长度至少为6个字符。' }, { status: 400 });
    }
    if (username === process.env.USERNAME) {
      return NextResponse.json({ error: '此用户名已被保留。' }, { status: 409 });
    }

    // 2. 检查用户是否已存在 (使用您已有的 db.checkUserExist)
    const exists = await db.checkUserExist(username); 
    if (exists) {
      return NextResponse.json({ error: '用户名已被占用。' }, { status: 409 });
    }

    // 3. 对密码进行哈希处理
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // 4. 创建新用户 (使用您已有的 db.registerUser)
    // 注意：我们将哈希后的密码传递给它
    await db.registerUser(username, passwordHash);

    return NextResponse.json({ ok: true, message: '用户注册成功。' }, { status: 201 });

  } catch (error) {
    console.error('注册 API 错误:', error);
    return NextResponse.json({ error: '发生内部服务器错误。' }, { status: 500 });
  }
}
