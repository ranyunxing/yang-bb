import { NextRequest, NextResponse } from 'next/server'
import { getCommissions } from '@/lib/api/commission-manager'
import { supabaseServer } from '@/lib/supabase/server'
import type { UnifiedCommission } from '@/types'

// 强制动态渲染
export const dynamic = 'force-dynamic'

/**
 * POST /api/commissions/sync
 * 手动同步佣金数据：从联盟 API 获取所有数据并存入数据库
 */
export async function POST(request: NextRequest) {
  try {
    const params = await request.json()
    const { 
      networkIds = [], 
      accountIds = [],
      beginDate,
      endDate 
    } = params

    // 验证必需参数
    if (!beginDate || !endDate) {
      return NextResponse.json(
        { error: '缺少必需参数: beginDate, endDate' },
        { status: 400 }
      )
    }

    console.log('🔄 开始同步佣金数据...', { beginDate, endDate, networkIds, accountIds })

    // 1. 获取所有佣金数据（复用现有逻辑）
    const result = await getCommissions({
      networkIds: networkIds.length > 0 ? networkIds : undefined,
      accountIds: accountIds.length > 0 ? accountIds : undefined,
      beginDate,
      endDate,
      curPage: 1,
      perPage: 2000, // 获取所有数据
      merchantName: undefined,
      mcid: undefined,
      status: undefined,
      paidStatus: undefined,
    })

    const commissions = result.data || []
    console.log(`✅ API 获取成功，共 ${commissions.length} 条数据`)

    if (commissions.length === 0) {
      return NextResponse.json({
        success: true,
        message: '没有数据需要同步',
        total: 0,
        inserted: 0,
        deleted: 0,
      })
    }

    // 2. 全量替换策略：先删除所有数据，再插入新数据
    console.log('🗑️  开始删除旧数据...')
    
    // 如果有筛选条件，只删除对应的数据；否则删除所有数据
    let deleteQuery: any = supabaseServer.from('commissions_cache').delete()
    
    if (networkIds && networkIds.length > 0) {
      deleteQuery = deleteQuery.in('network_id', networkIds)
    }
    if (accountIds && accountIds.length > 0) {
      deleteQuery = deleteQuery.in('account_id', accountIds)
    }
    
    // 如果指定了日期范围，也按日期删除（可选）
    // 注意：全量替换通常是删除所有数据，但如果只同步部分数据，可以只删除对应范围的数据
    
    const { error: deleteError } = await deleteQuery

    if (deleteError) {
      console.error('❌ 删除数据失败:', deleteError)
      throw new Error(`删除数据失败: ${deleteError.message}`)
    }

    console.log('✅ 旧数据删除成功')

    // 3. 批量插入新数据
    console.log('💾 开始插入新数据...')
    
    // 转换数据格式（UnifiedCommission -> 数据库格式）
    const dbRecords = commissions.map((item: UnifiedCommission) => ({
      network_id: item.networkId,
      account_id: item.accountId,
      order_id: item.orderId || null,
      order_time: item.orderTime || 0,
      merchant_name: item.merchantName || null,
      sale_amount: item.saleAmount || 0,
      commission: item.commission || 0,
      status: item.status || null,
      currency: item.currency || 'USD',
      customer_country: item.customerCountry || null,
      brand_id: item.brandId || null,
      mcid: item.mcid || null,
      paid_status: item.paidStatus ?? null,
      network_type: item.networkType || null,
      original_data: item.originalData || null,
    }))

    // 批量插入（每次 1000 条）
    const batchSize = 1000
    let insertedCount = 0
    let errors: string[] = []

    for (let i = 0; i < dbRecords.length; i += batchSize) {
      const batch = dbRecords.slice(i, i + batchSize)
      console.log(`📦 插入批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(dbRecords.length / batchSize)} (${batch.length} 条)`)

      const { error: insertError } = await supabaseServer
        .from('commissions_cache')
        .insert(batch)

      if (insertError) {
        console.error(`❌ 批次 ${Math.floor(i / batchSize) + 1} 插入失败:`, insertError)
        errors.push(`批次 ${Math.floor(i / batchSize) + 1} 插入失败: ${insertError.message}`)
      } else {
        insertedCount += batch.length
        console.log(`✅ 批次 ${Math.floor(i / batchSize) + 1} 插入成功`)
      }
    }

    // 4. 获取实际插入的数据量（用于验证）
    const { count } = await (supabaseServer
      .from('commissions_cache')
      .select('*', { count: 'exact', head: true }) as any)

    console.log(`✅ 数据同步完成，共插入 ${insertedCount} 条，数据库中现有 ${count || 0} 条`)

    return NextResponse.json({
      success: errors.length === 0,
      message: errors.length === 0 
        ? `同步成功：插入 ${insertedCount} 条数据`
        : `部分成功：插入 ${insertedCount} 条数据，但有 ${errors.length} 个批次失败`,
      total: commissions.length,
      inserted: insertedCount,
      deleted: count || 0,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error: any) {
    console.error('❌ 同步佣金数据失败:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error.message || '同步佣金数据失败',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

