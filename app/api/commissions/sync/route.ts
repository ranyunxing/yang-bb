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
    const fixedBeginDate = '2025-08-01'
    const today = new Date()
    const fixedEndDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    const params = await request.json()
    const { 
      networkIds = [], 
      accountIds = [],
    } = params

    console.log('🔄 开始同步佣金数据...', { beginDate: fixedBeginDate, endDate: fixedEndDate, networkIds, accountIds, mode: 'fixed-range' })

    // 1. 获取所有佣金数据（复用现有逻辑）
    const result = await getCommissions({
      networkIds: networkIds.length > 0 ? networkIds : undefined,
      accountIds: accountIds.length > 0 ? accountIds : undefined,
      beginDate: fixedBeginDate,
      endDate: fixedEndDate,
      curPage: 1,
      perPage: 2000, // 获取所有数据
      merchantName: undefined,
      mcid: undefined,
      status: undefined,
      paidStatus: undefined,
    })

    const apiErrors = (result as any)?.meta?.errors || []
    const apiWarnings = (result as any)?.meta?.warnings || []

    const commissions = result.data || []
    console.log(`✅ API 获取成功，共 ${commissions.length} 条数据`)

    if (commissions.length === 0) {
      return NextResponse.json({
        success: apiErrors.length === 0,
        message: apiErrors.length === 0 ? '没有数据需要同步' : 'API 有错误，本次未获取到任何数据',
        total: 0,
        inserted: 0,
        deleted: 0,
        apiErrors: apiErrors.length > 0 ? apiErrors : undefined,
        apiWarnings: apiWarnings.length > 0 ? apiWarnings : undefined,
      })
    }

    const toMillis = (timestampSecondsOrMillis: number) => {
      // 统一存毫秒；如果看起来像秒（< 2001-09-09 的毫秒量级阈值），则乘 1000
      if (!Number.isFinite(timestampSecondsOrMillis) || timestampSecondsOrMillis <= 0) return 0
      return timestampSecondsOrMillis < 1_000_000_000_000 ? timestampSecondsOrMillis * 1000 : timestampSecondsOrMillis
    }

    const buildSourceTransactionId = (item: UnifiedCommission) => {
      const raw = (item as any).id
      if (typeof raw === 'string' && raw.trim() !== '') return raw.trim()
      // 兜底：生成尽量稳定的“明细级”标识，避免 order_id 不唯一导致冲突
      const orderId = item.orderId || 'no-order'
      const orderTime = item.orderTime || 0
      const merchantName = item.merchantName || 'no-merchant'
      const saleAmount = item.saleAmount ?? 0
      const commission = item.commission ?? 0
      return `${item.networkType}:${item.accountId}:${orderId}:${orderTime}:${merchantName}:${saleAmount}:${commission}`
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
    const dbRecordsRaw = commissions.map((item: UnifiedCommission) => {
      // 确保 original_data 是有效 JSON 对象或 null
      let originalData: any = null
      if (item.originalData) {
        try {
          originalData = typeof item.originalData === 'string'
            ? JSON.parse(item.originalData)
            : item.originalData
        } catch (e) {
          console.warn(`⚠️  原始数据格式错误，跳过 original_data: ${e}`)
          originalData = null
        }
      }

      return {
        network_id: item.networkId,
        account_id: item.accountId,
        order_id: item.orderId || null,
        // cached 查询使用 JS Date.getTime()（毫秒），所以这里也统一用毫秒
        order_time: toMillis(item.orderTime || 0),
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
        // 明细级唯一标识：用于避免 order_id 不唯一导致整批插入失败
        source_transaction_id: buildSourceTransactionId(item),
        original_data: originalData,
      }
    })

    // 批内去重：避免同一批数据出现重复 source_transaction_id 触发唯一约束
    const seenSourceIds = new Set<string>()
    const dbRecords = dbRecordsRaw.filter((r: any) => {
      const key = String(r.source_transaction_id || '').trim()
      if (!key) return true
      if (seenSourceIds.has(key)) return false
      seenSourceIds.add(key)
      return true
    })

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
        errors.push(`批次 ${Math.floor(i / batchSize) + 1} 插入失败: ${insertError.message || JSON.stringify(insertError)}`)
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

    const success = apiErrors.length === 0 && errors.length === 0
    const partialReasons: string[] = []
    if (apiErrors.length > 0) partialReasons.push(`API 调用失败 ${apiErrors.length} 次`)
    if (errors.length > 0) partialReasons.push(`写库失败 ${errors.length} 个批次`)

    return NextResponse.json({
      success,
      message: success
        ? `同步成功：插入 ${insertedCount} 条数据`
        : `部分成功：插入 ${insertedCount} 条数据（${partialReasons.join('，')}）`,
      total: commissions.length,
      inserted: insertedCount,
      deleted: count || 0,
      errors: errors.length > 0 ? errors : undefined,
      apiErrors: apiErrors.length > 0 ? apiErrors : undefined,
      apiWarnings: apiWarnings.length > 0 ? apiWarnings : undefined,
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

