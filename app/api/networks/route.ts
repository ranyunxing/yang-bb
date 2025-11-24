import { NextResponse } from 'next/server'
import { getAllNetworks } from '@/lib/api/networks'

// 强制动态渲染
export const dynamic = 'force-dynamic'

/**
 * GET /api/networks
 * 获取所有联盟列表
 */
export async function GET() {
  try {
    const networks = await getAllNetworks()
    return NextResponse.json(networks)
  } catch (error: any) {
    console.error('获取联盟列表失败:', error)
    return NextResponse.json(
      { error: error.message || '获取联盟列表失败' },
      { status: 500 }
    )
  }
}

