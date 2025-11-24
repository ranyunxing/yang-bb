import { NextRequest, NextResponse } from 'next/server'

// 强制动态渲染
export const dynamic = 'force-dynamic'

const AUTH_COOKIE_NAME = 'auth_session'
const COOKIE_MAX_AGE = 24 * 60 * 60 // 24小时

/**
 * POST /api/auth/login
 * 验证密码并设置认证 Cookie
 */
export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json()

    // 验证密码
    const correctPassword = process.env.APP_PASSWORD

    if (!correctPassword) {
      console.error('❌ APP_PASSWORD 环境变量未设置')
      return NextResponse.json(
        { error: '服务器配置错误' },
        { status: 500 }
      )
    }

    if (password !== correctPassword) {
      return NextResponse.json(
        { error: '密码错误' },
        { status: 401 }
      )
    }

    // 生成认证 Cookie
    const timestamp = Date.now()
    const hash = Buffer.from(`${timestamp}:${correctPassword}`)
      .toString('base64')
      .substring(0, 16)
    const cookieValue = `${timestamp}:${hash}`

    // 设置 Cookie
    const response = NextResponse.json({ success: true })
    
    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: cookieValue,
      maxAge: COOKIE_MAX_AGE,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    })

    return response
  } catch (error: any) {
    console.error('登录错误:', error)
    return NextResponse.json(
      { error: '登录失败，请重试' },
      { status: 500 }
    )
  }
}

