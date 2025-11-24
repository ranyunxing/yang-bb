import { NextResponse } from 'next/server'

// 强制动态渲染
export const dynamic = 'force-dynamic'

const AUTH_COOKIE_NAME = 'auth_session'

/**
 * POST /api/auth/logout
 * 清除认证 Cookie
 */
export async function POST() {
  const response = NextResponse.json({ success: true })
  
  // 清除 Cookie
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: '',
    maxAge: 0,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  })

  return response
}

