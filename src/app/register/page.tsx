// src/app/register/page.tsx

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useSite } from '@/components/SiteProvider';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function RegisterPage() {
  const router = useRouter();
  const { siteName } = useSite();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] =useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (password !== confirmPassword) {
      setError('两次输入的密码不匹配。');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess('注册成功！正在跳转到登录页面...');
        setTimeout(() => {
          router.push('/login');
        }, 2000);
      } else {
        setError(data.error || '发生未知错误。');
      }
    } catch (err) {
      setError('网络错误，请稍后再试。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='relative min-h-screen flex items-center justify-center px-4 overflow-hidden'>
      <div className='absolute top-4 right-4'>
        <ThemeToggle />
      </div>
      <div className='relative z-10 w-full max-w-md rounded-3xl bg-gradient-to-b from-white/90 via-white/70 to-white/40 dark:from-zinc-900/90 dark:via-zinc-900/70 dark:to-zinc-900/40 backdrop-blur-xl shadow-2xl p-10 dark:border dark:border-zinc-800'>
        <h1 className='text-green-600 tracking-tight text-center text-3xl font-extrabold mb-8 bg-clip-text drop-shadow-sm'>
          注册 {siteName}
        </h1>
        <form onSubmit={handleSubmit} className='space-y-6'>
          <div>
            <label htmlFor='username' className='sr-only'>用户名</label>
            <input
              id='username'
              type='text'
              autoComplete='username'
              className='block w-full rounded-lg border-0 py-3 px-4 bg-white/60 dark:bg-zinc-800/60'
              placeholder='选择一个用户名'
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor='password' className='sr-only'>密码</label>
            <input
              id='password'
              type='password'
              autoComplete='new-password'
              className='block w-full rounded-lg border-0 py-3 px-4 bg-white/60 dark:bg-zinc-800/60'
              placeholder='创建一个密码'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor='confirm-password' className='sr-only'>确认密码</label>
            <input
              id='confirm-password'
              type='password'
              autoComplete='new-password'
              className='block w-full rounded-lg border-0 py-3 px-4 bg-white/60 dark:bg-zinc-800/60'
              placeholder='确认您的密码'
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          {error && <p className='text-sm text-red-500'>{error}</p>}
          {success && <p className='text-sm text-green-500'>{success}</p>}

          <button
            type='submit'
            disabled={loading || success !== null}
            className='inline-flex w-full justify-center rounded-lg bg-green-600 py-3 text-base font-semibold text-white shadow-lg disabled:opacity-50'
          >
            {loading ? '注册中...' : '创建账户'}
          </button>

          <p className="text-center text-sm text-gray-600 dark:text-gray-400">
            已经有账户了？{' '}
            <Link href="/login" className="font-semibold text-green-600 hover:underline">
              登录
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
