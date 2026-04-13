import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function mask(value: string | undefined, keep: number = 8): string {
  if (!value) return ''
  if (value.length <= keep) return value
  return `${value.slice(0, keep)}...`
}

/**
 * GET /api/debug/accounts-source
 * 调试接口：确认服务端实际连接的数据源和账号查询结果
 */
export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

    const { data, error } = await supabaseServer
      .from('network_accounts')
      .select('id, account_name, network_id, is_active, created_at')
      .eq('is_active', true)
      .order('account_name', { ascending: true })

    if (error) {
      throw error
    }

    const host = (() => {
      try {
        return new URL(supabaseUrl).host
      } catch {
        return 'invalid-url'
      }
    })()

    return NextResponse.json({
      debug: {
        supabaseHost: host,
        hasServiceRoleKey: Boolean(serviceRole),
        hasAnonKey: Boolean(anonKey),
        serviceRolePrefix: mask(serviceRole),
        anonKeyPrefix: mask(anonKey),
      },
      accountsCount: (data || []).length,
      accounts: (data || []).map((item: any) => ({
        id: item.id,
        accountName: item.account_name,
        networkId: item.network_id,
        isActive: item.is_active,
        createdAt: item.created_at,
      })),
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error?.message || 'debug query failed',
      },
      { status: 500 }
    )
  }
}
