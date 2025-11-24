import axios from 'axios'
import type { 
  LinkhaitaoRequest, 
  LinkhaitaoResponse, 
  UnifiedCommission,
  LinkhaitaoTransaction
} from '@/types'

/**
 * Linkhaitao 状态映射到统一状态
 */
function mapLinkhaitaoStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'untreated': 'Pending',
    'effective': 'Approved',
    'expired': 'Rejected'
  }
  return statusMap[status] || status
}

/**
 * Linkhaitao 联盟 API 调用
 */
export async function fetchLinkhaitaoCommissions(
  request: LinkhaitaoRequest
): Promise<LinkhaitaoResponse> {
  console.log('📡 Linkhaitao API 请求:', {
    beginDate: request.beginDate,
    endDate: request.endDate,
    token: request.token.substring(0, 8) + '...',
    source: request.source
  })
  
  // 构建 GET 请求的查询参数
  const params = new URLSearchParams({
    mod: 'medium',
    op: 'cashback2',
    token: request.token,
    begin_date: request.beginDate,
    end_date: request.endDate
  })
  
  // 添加可选参数
  if (request.datetype) {
    params.append('datetype', request.datetype)
  }
  if (request.order_id) {
    params.append('order_id', request.order_id)
  }
  if (request.status) {
    params.append('status', request.status)
  }
  if (request.tag) {
    params.append('tag', request.tag)
  }
  if (request.tag2) {
    params.append('tag2', request.tag2)
  }
  // per_page 参数（min 100, max 40000）
  const perPage = request.perPage || 40000
  if (perPage) {
    params.append('per_page', String(Math.max(100, Math.min(40000, perPage))))
  }
  // page 参数（从 1 开始）
  const page = request.page || request.curPage || 1
  if (page) {
    params.append('page', String(page))
  }
  
  const url = `https://www.linkhaitao.com/api.php?${params.toString()}`
  
  console.log('🔗 Linkhaitao API URL:', url.replace(/token=[^&]+/, 'token=xxxxxxx'))
  
  try {
    const response = await axios.get<any>(url)
    
    // 检查响应结构：可能是正常响应 {status: {code, msg}, data: {...}}
    // 也可能是错误响应 {code, msg}
    if (!response.data) {
      console.error('❌ Linkhaitao API 响应为空')
      throw new Error('Linkhaitao API 响应为空')
    }
    
    // 检查是否为错误响应格式 {code, msg}
    if (response.data.code && response.data.msg && !response.data.status) {
      console.error('❌ Linkhaitao API 错误响应:', response.data)
      throw new Error(`Linkhaitao API 错误: ${response.data.msg} (code: ${response.data.code})`)
    }
    
    // 检查正常响应结构
    if (!response.data.status) {
      console.error('❌ Linkhaitao API 响应结构异常:', response.data)
      throw new Error('Linkhaitao API 响应结构异常：缺少 status 字段')
    }
    
    console.log('✅ Linkhaitao API 响应:', {
      code: response.data.status.code,
      message: response.data.status.msg,
      total: response.data.data?.list?.length || 0
    })
    
    return response.data
  } catch (error: any) {
    // 处理 axios 错误
    if (error.response) {
      // API 返回了错误响应
      console.error('❌ Linkhaitao API HTTP 错误:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      })
      throw new Error(`Linkhaitao API HTTP 错误: ${error.response.status} - ${error.response.statusText}`)
    } else if (error.request) {
      // 请求发送但无响应
      console.error('❌ Linkhaitao API 无响应:', error.request)
      throw new Error('Linkhaitao API 请求超时或无响应')
    } else {
      // 其他错误
      console.error('❌ Linkhaitao API 请求错误:', error.message)
      throw new Error(`Linkhaitao API 请求错误: ${error.message}`)
    }
  }
}

/**
 * 将 Linkhaitao 数据转换为统一格式
 */
export function transformLinkhaitaoToUnified(
  data: LinkhaitaoTransaction,
  networkId: string,
  accountId: string
): UnifiedCommission {
  const anyData = data as any
  
  // 获取字段值（兼容多种格式）
  const pick = (obj: any, ...keys: string[]) => {
    for (const k of keys) {
      const v = obj?.[k]
      if (v !== undefined && v !== null && v !== '') return v
    }
    return undefined
  }

  const signId = pick(anyData, 'sign_id')
  const orderId = pick(anyData, 'order_id')
  const orderTime = pick(anyData, 'order_time')
  const merchantName = pick(anyData, 'advertiser_name')
  const saleAmount = pick(anyData, 'sale_amount')
  const cashback = pick(anyData, 'cashback')
  const status = pick(anyData, 'status')
  const mcid = pick(anyData, 'mcid')
  const brandId = pick(anyData, 'm_id') // Linkhaitao 的 m_id 对应品牌 ID

  // 处理 order_time（可能是字符串日期格式或数字格式的秒级时间戳）
  let orderTimestamp = 0
  if (orderTime) {
    if (typeof orderTime === 'string') {
      // 尝试解析日期字符串 "2025-10-14 15:33:14" 或时间戳字符串
      if (orderTime.includes('-')) {
        // 日期字符串格式，转换为时间戳
        const date = new Date(orderTime)
        orderTimestamp = Math.floor(date.getTime() / 1000) // 转换为秒级时间戳
      } else {
        // 时间戳字符串格式
        orderTimestamp = Number(orderTime) || 0
      }
    } else {
      orderTimestamp = orderTime as number
    }
  }

  // 处理金额（字符串或数字格式，转换为数字）
  const saleAmountNum = typeof saleAmount === 'string' ? Number(saleAmount) : (saleAmount || 0)
  const cashbackNum = typeof cashback === 'string' ? Number(cashback) : (cashback || 0)

  // 映射状态
  const mappedStatus = status ? mapLinkhaitaoStatus(status) : 'Unknown'

  return {
    id: signId || orderId || '',
    networkId,
    networkType: 'linkhaitao',
    accountId,
    orderId: orderId || '',
    orderTime: orderTimestamp,
    merchantName: merchantName || '',
    saleAmount: saleAmountNum || 0,
    commission: cashbackNum || 0,
    status: mappedStatus,
    currency: 'USD', // Linkhaitao 默认 USD
    mcid: mcid || undefined,
    brandId: brandId || undefined,
    // 保留原始数据
    originalData: data,
  }
}

/**
 * Linkhaitao API 调用并转换为统一格式
 */
export async function getLinkhaitaoCommissions(
  request: LinkhaitaoRequest,
  networkId: string,
  accountId: string
): Promise<UnifiedCommission[]> {
  const response = await fetchLinkhaitaoCommissions(request)
  
  // 检查响应状态码（0 = 成功）
  if (response.status.code !== 0) {
    throw new Error(`Linkhaitao API Error: ${response.status.msg} (code: ${response.status.code})`)
  }
  
  // 检查 data.list 是否为数组
  if (!Array.isArray(response.data.list)) {
    console.error('❌ Linkhaitao API 返回的 data.list 不是数组:', typeof response.data.list, response.data.list)
    return []
  }
  
  // 如果是空数组，直接返回
  if (response.data.list.length === 0) {
    console.log('⚠️  Linkhaitao API 返回空数据数组')
    return []
  }
  
  console.log('📦 Linkhaitao 原始数据样本:', response.data.list[0])
  
  const transformed = response.data.list.map(item => 
    transformLinkhaitaoToUnified(item, networkId, accountId)
  )
  
  console.log('🔄 转换后的数据样本:', transformed[0])
  
  return transformed
}

