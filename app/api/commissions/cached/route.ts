import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import type { CommissionQueryParams } from '@/types'

// 强制动态渲染
export const dynamic = 'force-dynamic'

/**
 * POST /api/commissions/cached
 * 从数据库查询缓存的佣金数据（支持筛选和分页）
 */
export async function POST(request: NextRequest) {
  try {
    const params: CommissionQueryParams = await request.json()
    const skipCount = Boolean((params as any).skipCount)
    const knownTotal = Number((params as any).knownTotal)
    const skipSummary = Boolean((params as any).skipSummary)
    const skipMerchantAgg = Boolean((params as any).skipMerchantAgg)
    const {
      networkIds = [],
      accountIds = [],
      beginDate,
      endDate,
      curPage = 1,
      perPage = 20,
      merchantName,
      mcid,
      status,
      paidStatus,
    } = params
    
    // 从 params 中提取 brandId（可能不在类型定义中）
    const brandId = (params as any).brandId

    // 验证必需参数
    if (!beginDate || !endDate) {
      return NextResponse.json(
        { error: '缺少必需参数: beginDate, endDate' },
        { status: 400 }
      )
    }

    console.log('🔍 查询缓存数据...', {
      beginDate,
      endDate,
      networkIds,
      accountIds,
      curPage,
      perPage,
      merchantName,
      mcid,
      status,
      paidStatus,
      skipCount,
      skipSummary,
      skipMerchantAgg,
      knownTotal: Number.isFinite(knownTotal) ? knownTotal : undefined,
    })

    // 1. 时间范围筛选
    const beginTimestamp = new Date(beginDate).getTime()
    const endTimestamp = new Date(endDate).getTime() + 24 * 60 * 60 * 1000 - 1 // 包含结束日期当天

    let total = 0
    let totalPages = 0

    // 2. 获取总数（用于分页）
    // 性能优化：翻页时可由前端传 knownTotal 并设置 skipCount=true，避免每次都 count(*)
    if (skipCount && Number.isFinite(knownTotal) && knownTotal >= 0) {
      total = knownTotal
      totalPages = Math.ceil(total / perPage)
    } else {
      let countQuery: any = supabaseServer
        .from('commissions_cache_view')
        .select('*', { count: 'exact', head: true })
        .gte('order_time', beginTimestamp)
        .lte('order_time', endTimestamp)

      // 应用所有筛选条件到 count 查询
      if (networkIds && networkIds.length > 0) {
        countQuery = countQuery.in('network_id', networkIds)
      }
      if (accountIds && accountIds.length > 0) {
        countQuery = countQuery.in('account_id', accountIds)
      }
      if (merchantName) {
        countQuery = countQuery.ilike('merchant_name', `%${merchantName}%`)
      }
      if (mcid) {
        countQuery = countQuery.eq('mcid', mcid)
      }
      if (brandId) {
        countQuery = countQuery.eq('brand_id', brandId)
      }
      if (status && status !== '全部') {
        countQuery = countQuery.eq('status', status)
      }
      if (paidStatus && paidStatus !== '全部') {
        const paidStatusNum = paidStatus === '已支付' ? 1 : 0
        countQuery = countQuery.eq('paid_status', paidStatusNum)
      }

      const { count, error: countError } = await countQuery
      if (countError) throw countError

      total = count || 0
      totalPages = Math.ceil(total / perPage)
    }

    // 12. 重新构建查询并分页
    let pagedQuery = supabaseServer
      .from('commissions_cache_view')
      .select('*')
      .gte('order_time', beginTimestamp)
      .lte('order_time', endTimestamp)
      .order('order_time', { ascending: false })

    // 重新应用所有筛选条件
    if (networkIds && networkIds.length > 0) {
      pagedQuery = pagedQuery.in('network_id', networkIds)
    }
    if (accountIds && accountIds.length > 0) {
      pagedQuery = pagedQuery.in('account_id', accountIds)
    }
    if (merchantName) {
      pagedQuery = pagedQuery.ilike('merchant_name', `%${merchantName}%`)
    }
    if (mcid) {
      pagedQuery = pagedQuery.eq('mcid', mcid)
    }
    if (brandId) {
      pagedQuery = pagedQuery.eq('brand_id', brandId)
    }
    if (status && status !== '全部') {
      pagedQuery = pagedQuery.eq('status', status)
    }
    if (paidStatus && paidStatus !== '全部') {
      const paidStatusNum = paidStatus === '已支付' ? 1 : 0
      pagedQuery = pagedQuery.eq('paid_status', paidStatusNum)
    }

    // 分页
    const startIndex = (curPage - 1) * perPage
    pagedQuery = pagedQuery.range(startIndex, startIndex + perPage - 1)

    // 13. 执行分页查询
    const { data, error } = await pagedQuery

    if (error) {
      throw error
    }

    console.log(`✅ 查询成功：找到 ${total} 条数据，返回第 ${curPage} 页（${data?.length || 0} 条）`, {
      countStrategy: skipCount ? 'skipCount' : 'count',
    })

    // 14. 转换数据格式（数据库格式 -> UnifiedCommission）
    const commissions = (data || []).map((item: any) => ({
      id: item.id,
      networkId: item.network_id,
      networkType: item.network_type,
      accountId: item.account_id,
      orderId: item.order_id,
      orderTime: item.order_time,
      merchantName: item.merchant_name,
      saleAmount: Number(item.sale_amount) || 0,
      commission: Number(item.commission) || 0,
      status: item.status,
      currency: item.currency,
      customerCountry: item.customer_country,
      brandId: item.brand_id,
      mcid: item.mcid,
      paidStatus: item.paid_status,
      originalData: item.original_data,
      // 额外字段（来自视图）
      networkName: item.network_name,
      accountName: item.account_name,
    }))

    // 15. 计算汇总数据
    let summary: any = undefined
    let merchantAgg: any = undefined

    if (!skipSummary) {
      // 汇总必须应用“相同筛选条件”，否则顶部统计会不准
      let summaryQuery = supabaseServer
        .from('commissions_cache_view')
        .select('network_id, network_name, account_id, account_name, sale_amount, commission, status, merchant_name, mcid')
        .gte('order_time', beginTimestamp)
        .lte('order_time', endTimestamp)

      if (networkIds && networkIds.length > 0) summaryQuery = summaryQuery.in('network_id', networkIds)
      if (accountIds && accountIds.length > 0) summaryQuery = summaryQuery.in('account_id', accountIds)
      if (merchantName) summaryQuery = summaryQuery.ilike('merchant_name', `%${merchantName}%`)
      if (mcid) summaryQuery = summaryQuery.eq('mcid', mcid)
      if (brandId) summaryQuery = summaryQuery.eq('brand_id', brandId)
      if (status && status !== '全部') summaryQuery = summaryQuery.eq('status', status)
      // paidStatus 已从 UI 移除，这里不再应用 paidStatus 过滤

      const { data: allData, error: summaryError } = await summaryQuery
      if (summaryError) throw summaryError

      const totalAmount = (allData || []).reduce((sum: number, item: any) => sum + (Number(item.sale_amount) || 0), 0)
      const totalCommission = (allData || []).reduce((sum: number, item: any) => sum + (Number(item.commission) || 0), 0)

      summary = {
        totalAmount,
        totalCommission,
        networks: {},
        statusCounts: { Pending: 0, Rejected: 0, Approved: 0 },
      }

      ;(allData || []).forEach((item: any) => {
        const networkId = item.network_id
        const accountId = item.account_id
        if (!summary.networks[networkId]) {
          summary.networks[networkId] = { networkName: item.network_name, amount: 0, commission: 0, accounts: {} }
        }
        if (!summary.networks[networkId].accounts[accountId]) {
          summary.networks[networkId].accounts[accountId] = { accountName: item.account_name, amount: 0, commission: 0 }
        }
        summary.networks[networkId].amount += Number(item.sale_amount) || 0
        summary.networks[networkId].commission += Number(item.commission) || 0
        summary.networks[networkId].accounts[accountId].amount += Number(item.sale_amount) || 0
        summary.networks[networkId].accounts[accountId].commission += Number(item.commission) || 0

        const st = item.status
        if (st === 'Pending' || st === 'Rejected' || st === 'Approved') {
          summary.statusCounts[st] = (summary.statusCounts[st] || 0) + 1
        }
      })

      // 商家聚合：用于悬浮提示与“商家汇总”
      // 为避免翻页反复计算，前端翻页会设置 skipMerchantAgg=true
      if (!skipMerchantAgg) {
        // Tooltip 用：仅按时间范围+network/account 做“全量”商家状态计数（不受筛选影响）
        let baseAggQuery = supabaseServer
          .from('commissions_cache_view')
          .select('merchant_name, mcid, status')
          .gte('order_time', beginTimestamp)
          .lte('order_time', endTimestamp)

        if (networkIds && networkIds.length > 0) baseAggQuery = baseAggQuery.in('network_id', networkIds)
        if (accountIds && accountIds.length > 0) baseAggQuery = baseAggQuery.in('account_id', accountIds)

        const { data: baseAggData, error: baseAggError } = await baseAggQuery
        if (baseAggError) throw baseAggError

        const byMerchantName: Record<string, { Pending: number; Rejected: number; Approved: number; mcid?: string }> = {}
        const byMcid: Record<string, { Pending: number; Rejected: number; Approved: number; merchantName?: string }> = {}

        ;(baseAggData || []).forEach((row: any) => {
          const mName = row.merchant_name || 'Unknown'
          const mMcid = row.mcid || ''
          const st = row.status

          if (!byMerchantName[mName]) byMerchantName[mName] = { Pending: 0, Rejected: 0, Approved: 0, mcid: mMcid || undefined }
          if (mMcid && !byMcid[mMcid]) byMcid[mMcid] = { Pending: 0, Rejected: 0, Approved: 0, merchantName: mName }

          if (st === 'Pending' || st === 'Rejected' || st === 'Approved') {
            byMerchantName[mName][st] = (byMerchantName[mName][st] || 0) + 1
            if (mMcid) byMcid[mMcid][st] = (byMcid[mMcid][st] || 0) + 1
          }
        })

        // 商家汇总用：在“当前筛选结果(allData)”里提取去重 mcid 列表（只在筛选状态时前端展示）
        const merchantList: Array<{ mcid: string; merchantName?: string }> = []
        const seen = new Set<string>()
        ;(allData || []).forEach((row: any) => {
          const m = String(row.mcid || '').trim()
          if (!m) return
          if (seen.has(m)) return
          seen.add(m)
          merchantList.push({ mcid: m, merchantName: row.merchant_name || undefined })
        })
        merchantList.sort((a, b) => a.mcid.localeCompare(b.mcid))

        merchantAgg = { byMerchantName, byMcid, merchantList }
      }
    }

    return NextResponse.json({
      total,
      curPage,
      totalPage: totalPages,
      hasNext: curPage < totalPages,
      data: commissions,
      summary: summary || undefined,
      merchantAgg: merchantAgg || undefined,
      meta: {
        success: true,
        errors: [],
        warnings: [],
        infos: [`从数据库查询到 ${total} 条数据`],
      },
    })
  } catch (error: any) {
    console.error('❌ 查询缓存数据失败:', error)
    return NextResponse.json(
      {
        error: error.message || '查询缓存数据失败',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}

