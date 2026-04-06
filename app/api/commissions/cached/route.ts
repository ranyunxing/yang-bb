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
    const totalAmount = commissions.reduce((sum, item) => sum + (item.saleAmount || 0), 0)
    const totalCommission = commissions.reduce((sum, item) => sum + (item.commission || 0), 0)

    // 按联盟和账号分组统计
    const summary: any = {
      totalAmount,
      totalCommission,
      networks: {},
    }

    // 获取所有数据用于汇总（不分页，需要应用相同的筛选条件）
    // 注意：这里只获取汇总需要的数据，避免性能问题
    let summaryQuery = supabaseServer
      .from('commissions_cache_view')
      .select('network_id, network_name, account_id, account_name, sale_amount, commission')
      .gte('order_time', beginTimestamp)
      .lte('order_time', endTimestamp)

    if (networkIds && networkIds.length > 0) {
      summaryQuery = summaryQuery.in('network_id', networkIds)
    }
    if (accountIds && accountIds.length > 0) {
      summaryQuery = summaryQuery.in('account_id', accountIds)
    }

    const { data: allData } = await summaryQuery

    if (allData) {
      allData.forEach((item: any) => {
        const networkId = item.network_id
        const accountId = item.account_id

        if (!summary.networks[networkId]) {
          summary.networks[networkId] = {
            networkName: item.network_name,
            amount: 0,
            commission: 0,
            accounts: {},
          }
        }

        if (!summary.networks[networkId].accounts[accountId]) {
          summary.networks[networkId].accounts[accountId] = {
            accountName: item.account_name,
            amount: 0,
            commission: 0,
          }
        }

        summary.networks[networkId].amount += Number(item.sale_amount) || 0
        summary.networks[networkId].commission += Number(item.commission) || 0
        summary.networks[networkId].accounts[accountId].amount += Number(item.sale_amount) || 0
        summary.networks[networkId].accounts[accountId].commission += Number(item.commission) || 0
      })
    }

    return NextResponse.json({
      total,
      curPage,
      totalPage: totalPages,
      hasNext: curPage < totalPages,
      data: commissions,
      summary,
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

