import { NextResponse } from 'next/server'
import { searchMerchants } from '@/lib/api/merchant-manager'

// 强制动态渲染，因为使用了 request.url
export const dynamic = 'force-dynamic'

/**
 * GET /api/merchants/search
 * 搜索广告商
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query') || undefined
    const networkId = searchParams.get('networkId') || undefined
    const accountId = searchParams.get('accountId') || undefined
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    
    const result = await searchMerchants({
      query,
      networkId,
      accountId,
      limit,
      offset
    })
    
    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error: any) {
    console.error('❌ 搜索广告商失败:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error.message || '搜索广告商失败',
        message: error.message || '搜索广告商失败'
      },
      { status: 500 }
    )
  }
}

