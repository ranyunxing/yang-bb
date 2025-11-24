import { NextResponse } from 'next/server'
import { syncAllMerchants } from '@/lib/api/merchant-manager'

// 强制动态渲染
export const dynamic = 'force-dynamic'

/**
 * POST /api/merchants/sync
 * 同步所有账号的广告商数据
 */
export async function POST() {
  try {
    console.log('🚀 收到同步广告商数据请求')
    
    const result = await syncAllMerchants()
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `同步成功！共获取 ${result.totalMerchants} 个广告商`,
        data: result
      })
    } else {
      return NextResponse.json({
        success: false,
        message: `同步完成，但有部分失败。成功: ${result.successAccounts} 个账号, 失败: ${result.failedAccounts} 个账号, 共获取 ${result.totalMerchants} 个广告商`,
        data: result
      }, { status: 200 }) // 即使有失败也返回200，但success为false
    }
  } catch (error: any) {
    console.error('❌ 同步广告商数据失败:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error.message || '同步广告商数据失败',
        message: error.message || '同步广告商数据失败'
      },
      { status: 500 }
    )
  }
}

