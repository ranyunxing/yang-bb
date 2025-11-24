import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Cookie 名称
const AUTH_COOKIE_NAME = 'auth_session'
// Cookie 有效期：24小时（秒）
const COOKIE_MAX_AGE = 24 * 60 * 60

/**
 * 检查 Cookie 是否有效
 */
function isAuthenticated(request: NextRequest): boolean {
  const cookie = request.cookies.get(AUTH_COOKIE_NAME)
  
  if (!cookie) {
    return false
  }
  
  try {
    // Cookie 值格式：timestamp:hash
    // 我们存储登录时间戳，检查是否在24小时内
    const [timestamp] = cookie.value.split(':')
    const loginTime = parseInt(timestamp, 10)
    const now = Date.now()
    const elapsed = (now - loginTime) / 1000 // 转换为秒
    
    // 检查是否在24小时内
    return elapsed < COOKIE_MAX_AGE
  } catch {
    return false
  }
}

/**
 * 生成认证 Cookie 值
 */
function generateAuthCookie(): string {
  const timestamp = Date.now()
  // 简单的哈希（实际项目中可以使用更安全的方法）
  const hash = Buffer.from(`${timestamp}:${process.env.APP_PASSWORD}`).toString('base64').substring(0, 16)
  return `${timestamp}:${hash}`
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // 允许访问登录页面和登录 API
  if (pathname === '/login' || pathname.startsWith('/api/auth/')) {
    return NextResponse.next()
  }
  
  // 检查是否已认证
  if (!isAuthenticated(request)) {
    // 未认证，重定向到登录页
    const loginUrl = new URL('/login', request.url)
    // 保存原始访问路径，登录后可以重定向回来
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }
  
  // 已认证，继续访问
  return NextResponse.next()
}

// 配置需要保护的路径
export const config = {
  matcher: [
    /*
     * 匹配所有路径，除了：
     * - api/auth (登录/登出 API)
     * - _next/static (静态文件)
     * - _next/image (图片优化)
     * - favicon.ico (图标)
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico).*)',
  ],
}

