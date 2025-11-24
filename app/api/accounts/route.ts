import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import type { NetworkAccount } from '@/types'

// 强制动态渲染，因为使用了 request.url
export const dynamic = 'force-dynamic'

/**
 * GET /api/accounts
 * 获取所有联盟账号列表
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const networkId = searchParams.get('networkId')
    
    let query = supabaseServer
      .from('network_accounts')
      .select('*')
      .eq('is_active', true)
      .order('account_name', { ascending: true })
    
    if (networkId) {
      query = query.eq('network_id', networkId)
    }
    
    const { data, error } = await query
    
    if (error) throw error
    
    // 转换数据库字段名到 TypeScript 接口
    const accounts: NetworkAccount[] = (data || []).map(item => ({
      id: item.id,
      networkId: item.network_id,
      token: item.token,
      accountName: item.account_name,
      isActive: item.is_active,
      createdAt: item.created_at,
      updatedAt: item.updated_at
    }))
    
    return NextResponse.json(accounts)
  } catch (error: any) {
    console.error('获取账号列表失败:', error)
    return NextResponse.json(
      { error: error.message || '获取账号列表失败' },
      { status: 500 }
    )
  }
}

