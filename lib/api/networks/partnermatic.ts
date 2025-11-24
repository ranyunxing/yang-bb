import axios from 'axios'
import type { 
  PartnermaticRequest, 
  PartnermaticResponse, 
  UnifiedCommission,
  PartnermaticTransaction
} from '@/types'

/**
 * Partnermatic 联盟 API 调用
 */
export async function fetchPartnermaticCommissions(
  request: PartnermaticRequest
): Promise<PartnermaticResponse> {
  console.log('📡 Partnermatic API 请求:', {
    beginDate: request.beginDate,
    endDate: request.endDate,
    token: request.token.substring(0, 8) + '...',
    source: request.source
  })
  
  try {
    const response = await axios.post<PartnermaticResponse>(
      'https://api.partnermatic.com/api/transaction',
      request,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )
    
    console.log('✅ Partnermatic API 响应:', {
      code: response.data.code,
      message: response.data.message,
      total: response.data.data?.total || 0
    })
    
    return response.data
  } catch (error: any) {
    // 处理 axios 错误
    if (error.response) {
      // API 返回了错误响应
      console.error('❌ Partnermatic API HTTP 错误:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      })
      throw new Error(`Partnermatic API HTTP 错误: ${error.response.status} - ${error.response.statusText}`)
    } else if (error.request) {
      // 请求发送但无响应
      console.error('❌ Partnermatic API 无响应:', error.request)
      throw new Error('Partnermatic API 请求超时或无响应')
    } else {
      // 其他错误
      console.error('❌ Partnermatic API 请求错误:', error.message)
      throw new Error(`Partnermatic API 请求错误: ${error.message}`)
    }
  }
}

/**
 * 将 Partnermatic 数据转换为统一格式
 */
export function transformPartnermaticToUnified(
  data: PartnermaticTransaction,
  networkId: string,
  accountId: string
): UnifiedCommission {
  // 兼容驼峰与下划线字段名
  const anyData = data as any
  const pick = (obj: any, ...keys: string[]) => {
    for (const k of keys) {
      const v = obj?.[k]
      if (v !== undefined && v !== null && v !== '') return v
    }
    return undefined
  }

  const orderId = pick(anyData, 'orderId', 'order_id')
  const orderTime = pick(anyData, 'orderTime', 'order_time')
  const merchantName = pick(anyData, 'merchantName', 'merchant_name')
  const saleAmount = Number(pick(anyData, 'saleAmount', 'sale_amount')) || 0
  const commission = Number(pick(anyData, 'saleComm', 'sale_comm')) || 0
  const customerCountry = pick(anyData, 'customerCountry', 'customer_country')
  const brandId = pick(anyData, 'brandId', 'brand_id')
  const mcid = pick(anyData, 'mcid')
  const paidStatus = pick(anyData, 'paidStatus', 'paid_status')

  return {
    id: pick(anyData, 'partnermaticId', 'partnermatic_id') as string,
    networkId,
    networkType: 'partnermatic',
    accountId,
    orderId: orderId as string,
    orderTime: (orderTime as number) || 0,
    merchantName: (merchantName as string) || '',
    saleAmount,
    commission,
    status: pick(anyData, 'status') as string,
    currency: 'USD', // Partnermatic 默认 USD
    customerCountry: (customerCountry as string) || undefined,
    brandId: brandId as string | undefined,
    mcid: mcid as string | undefined,
    paidStatus: typeof paidStatus === 'number' ? paidStatus : undefined,
    // 保留原始数据
    originalData: data,
  }
}

/**
 * Partnermatic API 调用并转换为统一格式
 * 自动处理分页，获取所有数据
 */
export async function getPartnermaticCommissions(
  request: PartnermaticRequest,
  networkId: string,
  accountId: string
): Promise<UnifiedCommission[]> {
  let allCommissions: UnifiedCommission[] = []
  let currentPage = request.curPage || 1
  let totalPages = 1
  let firstResponse = true
  const perPage = request.perPage || 20
  
  console.log(`📄 Partnermatic 分页参数: curPage=${currentPage}, perPage=${perPage}`)
  
  // 循环获取所有页面的数据
  while (true) {
    const pageRequest = { ...request, curPage: currentPage, perPage }
    const response = await fetchPartnermaticCommissions(pageRequest)
    
    if (response.code !== '0') {
      throw new Error(`Partnermatic API Error: ${response.message}`)
    }
    
    // 防御性检查：确保 data 存在
    if (!response.data) {
      if (firstResponse) {
        console.warn('⚠️  Partnermatic API 返回的 data 字段不存在')
        return []
      }
      break
    }
    
    // 第一次请求时记录总页数
    if (firstResponse) {
      totalPages = response.data.totalPage || 1
      const actualTotal = response.data.total || 0
      
      // 如果API返回的totalPage看起来不正确（比如total很大但totalPage=1），
      // 根据total和perPage计算合理的总页数
      if (actualTotal > 0 && totalPages === 1 && actualTotal > perPage) {
        const calculatedPages = Math.ceil(actualTotal / perPage)
        console.log(`⚠️  Partnermatic API返回的totalPage=${totalPages}可能不正确，根据total=${actualTotal}和perPage=${perPage}计算，应该有${calculatedPages}页`)
        totalPages = calculatedPages
      }
      
      console.log(`📄 Partnermatic 总共 ${totalPages} 页数据需要获取（总记录数: ${actualTotal}，每页: ${perPage}）`)
      firstResponse = false
      
      // 如果总页数为0或总记录数为0，直接返回
      if (totalPages === 0 || actualTotal === 0) {
        console.log('⚠️  Partnermatic 总页数为0或总记录数为0，没有数据')
        return []
      }
    }
    
    // 检查 data.list 是否为数组
    if (!Array.isArray(response.data.list)) {
      console.error('❌ Partnermatic API 返回的 data.list 不是数组:', {
        type: typeof response.data.list,
        value: response.data.list,
        total: response.data.total,
        hasData: !!response.data
      })
      break
    }
    
    // 处理当前页的数据
    const currentPageDataCount = response.data.list.length
    if (currentPageDataCount === 0) {
      console.log(`⚠️  Partnermatic 第 ${currentPage}/${totalPages} 页为空`)
      // 如果当前页为空且不是第一页，说明已经获取完所有数据
      if (currentPage > 1) {
        break
      }
    } else {
      if (currentPage === 1) {
        console.log('📦 Partnermatic 原始数据样本:', response.data.list[0])
      }
      
      const transformed = response.data.list.map(item => 
        transformPartnermaticToUnified(item, networkId, accountId)
      )
      
      allCommissions = allCommissions.concat(transformed)
      
      if (currentPage === 1) {
        console.log('🔄 转换后的数据样本:', transformed[0])
      }
      
      console.log(`📦 Partnermatic 第 ${currentPage}/${totalPages} 页: ${transformed.length} 条数据`, {
        hasNext: response.data.hasNext,
        total: response.data.total,
        curPage: response.data.curPage,
        totalPage: response.data.totalPage
      })
      
      // 如果当前页返回的数据量小于perPage，说明这是最后一页
      if (currentPageDataCount < perPage) {
        console.log(`✅ Partnermatic 第 ${currentPage} 页返回 ${currentPageDataCount} 条数据 < perPage ${perPage}，这是最后一页`)
        break
      }
    }
    
    // 检查是否还有下一页
    // 使用多个条件判断：1. 当前页数 >= 总页数 2. hasNext为false 3. 当前页数据量 < perPage
    if (currentPage >= totalPages) {
      console.log(`✅ Partnermatic 已获取所有页面（当前页 ${currentPage} >= 总页数 ${totalPages}）`)
      break
    }
    
    if (response.data.hasNext === false) {
      console.log(`✅ Partnermatic API 返回 hasNext=false，已获取所有数据`)
      break
    }
    
    currentPage++
    
    // 安全限制：防止无限循环
    if (currentPage > 1000) {
      console.warn(`⚠️  Partnermatic 分页循环超过1000页，强制停止`)
      break
    }
  }
  
  console.log(`✅ Partnermatic 总共获取 ${allCommissions.length} 条数据（来自 ${totalPages} 页）`)
  
  return allCommissions
}

