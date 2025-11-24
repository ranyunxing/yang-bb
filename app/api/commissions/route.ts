import { NextRequest, NextResponse } from 'next/server'
import { getCommissions } from '@/lib/api/commission-manager'
import type { CommissionQueryParams } from '@/types'

// 强制动态渲染
export const dynamic = 'force-dynamic'

/**
 * POST /api/commissions
 * 查询业绩数据
 */
export async function POST(request: NextRequest) {
  try {
    const params: CommissionQueryParams = await request.json()
    
    // 验证必需参数
    if (!params.beginDate || !params.endDate) {
      return NextResponse.json(
        { error: '缺少必需参数: beginDate, endDate' },
        { status: 400 }
      )
    }
    
    // 调用业绩管理器
    const result = await getCommissions(params)
    
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('查询业绩失败:', error)
    return NextResponse.json(
      { error: error.message || '查询业绩失败' },
      { status: 500 }
    )
  }
}

