import axios from 'axios'
import type { 
  LinkbuxRequest, 
  LinkbuxResponse, 
  UnifiedCommission,
  LinkbuxTransaction
} from '@/types'

/**
 * Linkbux 状态映射到统一状态
 */
function mapLinkbuxStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'Pending': 'Pending',
    'Approved': 'Approved',
    'Rejected': 'Rejected'
  }
  return statusMap[status] || status
}


/**
 * Linkbux 联盟 API 调用
 */
export async function fetchLinkbuxCommissions(
  request: LinkbuxRequest
): Promise<LinkbuxResponse> {
  console.log('📡 Linkbux API 请求:', {
    beginDate: request.beginDate,
    endDate: request.endDate,
    validationDateBegin: request.validationDateBegin,
    validationDateEnd: request.validationDateEnd,
    token: request.token.substring(0, 8) + '...',
    source: request.source
  })
  
  // 构建 GET 请求的查询参数（基础参数）
  const params = new URLSearchParams({
    mod: 'medium',
    op: 'transaction_v2', // 使用 transaction_v2 API
    token: request.token
  })
  
  // 日期参数：begin_date/end_date 和 validation_date_begin/validation_date_end 二选一
  // 根据 API 文档：Either transaction period or validation period is mandatory
  if (request.validationDateBegin && request.validationDateEnd) {
    // 使用 validation_date 参数（按验证日期筛选）
    params.append('validation_date_begin', request.validationDateBegin)
    params.append('validation_date_end', request.validationDateEnd)
  } else if (request.beginDate && request.endDate) {
    // 使用 begin_date 参数（按交易时间筛选）
    params.append('begin_date', request.beginDate)
    params.append('end_date', request.endDate)
  } else {
    throw new Error('Linkbux API: 必须提供 beginDate/endDate 或 validationDateBegin/validationDateEnd')
  }
  
  // 可选过滤参数
  if (request.order_id) {
    params.append('order_id', request.order_id)
  }
  if (request.status && request.status !== 'All') {
    params.append('status', request.status)
  }
  if (request.uid) {
    params.append('uid', request.uid)
  }
  if (request.uid2) {
    params.append('uid2', request.uid2)
  }
  if (request.mcid) {
    params.append('mcid', request.mcid)
  }
  if (request.offer_type) {
    params.append('offer_type', request.offer_type)
  }
  if (request.payment_id) {
    params.append('payment_id', request.payment_id)
  }
  if (request.settlement_id) {
    params.append('settlement_id', request.settlement_id)
  }
  
  // 分页参数
  if (request.page) {
    params.append('page', String(request.page))
  }
  // limit 参数：提供时使用提供的值，否则默认2000（transaction_v2 最大支持2000）
  const limit = request.limit ? Math.min(2000, request.limit) : 2000
  params.append('limit', String(limit))
  
  const url = `https://www.linkbux.com/api.php?${params.toString()}`
  
  console.log('🔗 Linkbux API URL:', url.replace(/token=[^&]+/, 'token=xxxxxxx'))
  
  try {
    const response = await axios.get<any>(url)
    
    // 检查响应结构
    if (!response.data) {
      console.error('❌ Linkbux API 响应为空')
      throw new Error('Linkbux API 响应为空')
    }
    
    // 检查是否为错误响应
    if (!response.data.status) {
      console.error('❌ Linkbux API 响应结构异常:', response.data)
      throw new Error('Linkbux API 响应结构异常：缺少 status 字段')
    }
    
    console.log('✅ Linkbux API 响应:', {
      code: response.data.status.code,
      message: response.data.status.msg,
      total_trans: response.data.data?.total_trans || 0,
      total_items: response.data.data?.total_items || 0,
      total_page: response.data.data?.total_page || 0,
      limit: response.data.data?.limit || 0,
      list_length: response.data.data?.list?.length || 0
    })
    
    // 🔍 调试：如果返回空数据，打印完整响应
    if (!response.data.data?.list || response.data.data.list.length === 0) {
      console.log('🔍 DEBUG - 空数据响应详情:', JSON.stringify({
        status: response.data.status,
        data: {
          total_page: response.data.data?.total_page,
          total_trans: response.data.data?.total_trans,
          total_items: response.data.data?.total_items,
          limit: response.data.data?.limit,
          list_length: response.data.data?.list?.length
        }
      }))
    } else {
      // 打印第一条和最后一条数据的时间戳（用于调试时间范围）
      const firstItem = response.data.data.list[0]
      const lastItem = response.data.data.list[response.data.data.list.length - 1]
      // order_time 可能是字符串或数字格式
      const firstOrderTime = typeof firstItem.order_time === 'string' 
        ? parseInt(firstItem.order_time, 10) 
        : firstItem.order_time
      const lastOrderTime = typeof lastItem.order_time === 'string'
        ? parseInt(lastItem.order_time, 10)
        : lastItem.order_time
      console.log('🔍 DEBUG - 返回数据时间范围:', {
        first_order_time: firstOrderTime,
        first_order_date: new Date(firstOrderTime * 1000).toISOString(),
        last_order_time: lastOrderTime,
        last_order_date: new Date(lastOrderTime * 1000).toISOString()
      })
    }
    
    return response.data
  } catch (error: any) {
    // 处理 axios 错误
    if (error.response) {
      // API 返回了错误响应
      console.error('❌ Linkbux API HTTP 错误:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      })
      throw new Error(`Linkbux API HTTP 错误: ${error.response.status} - ${error.response.statusText}`)
    } else if (error.request) {
      // 请求发送但无响应
      console.error('❌ Linkbux API 无响应:', error.request)
      throw new Error('Linkbux API 请求超时或无响应')
    } else {
      // 其他错误
      console.error('❌ Linkbux API 请求错误:', error.message)
      throw new Error(`Linkbux API 请求错误: ${error.message}`)
    }
  }
}

/**
 * 将 Linkbux 数据转换为统一格式
 * transaction_v2 API 返回的是扁平结构，每个 transaction 对象就是一条完整记录
 */
export function transformLinkbuxToUnified(
  transaction: LinkbuxTransaction,
  networkId: string,
  accountId: string
): UnifiedCommission {
  // 处理 order_time（可能是字符串或数字格式）
  const orderTime = typeof transaction.order_time === 'string' 
    ? parseInt(transaction.order_time, 10) 
    : (transaction.order_time || 0)
  
  // 处理金额（字符串或数字格式，转换为数字）
  const saleAmountNum = typeof transaction.sale_amount === 'string' 
    ? Number(transaction.sale_amount) 
    : (transaction.sale_amount || 0)
  const saleCommNum = typeof transaction.sale_comm === 'string' 
    ? Number(transaction.sale_comm) 
    : (transaction.sale_comm || 0)
  
  // 映射状态
  const mappedStatus = mapLinkbuxStatus(transaction.status)
  
  // 使用 linkbux_id 作为唯一标识
  const uniqueId = transaction.linkbux_id || ''
  
  return {
    id: uniqueId,
    networkId,
    networkType: 'linkbux',
    accountId,
    orderId: transaction.order_id || '',
    orderTime,
    merchantName: transaction.merchant_name || '',
    saleAmount: saleAmountNum,
    commission: saleCommNum,
    status: mappedStatus,
    currency: 'USD',
    customerCountry: transaction.customer_country,
    brandId: transaction.mid,
    mcid: transaction.mcid,
    // 额外字段保留在 originalData 中
    originalData: transaction,
  }
}

/**
 * Linkbux API 调用并转换为统一格式
 * 自动处理分页，获取所有数据
 */
export async function getLinkbuxCommissions(
  request: LinkbuxRequest,
  networkId: string,
  accountId: string
): Promise<UnifiedCommission[]> {
  let allCommissions: UnifiedCommission[] = []
  let currentPage = request.page || 1
  let totalPages = 1
  let firstResponse = true
  
  // 循环获取所有页面的数据
  while (currentPage <= totalPages) {
    const pageRequest = { ...request, page: currentPage }
    const response = await fetchLinkbuxCommissions(pageRequest)
    
    // 检查响应状态码（0 = 成功）
    if (response.status.code !== 0) {
      throw new Error(`Linkbux API Error: ${response.status.msg} (code: ${response.status.code})`)
    }
    
    // 第一次请求时记录总页数
    if (firstResponse) {
      totalPages = Number(response.data.total_page) || 1
      console.log(`📄 Linkbux 总共 ${totalPages} 页数据需要获取`)
      firstResponse = false
      
      // 如果总页数为0，直接返回
      if (totalPages === 0) {
        console.log('⚠️  Linkbux 总页数为0，没有数据')
        return []
      }
    }
    
    // 检查 data.list 是否为数组
    if (!Array.isArray(response.data.list)) {
      console.error('❌ Linkbux API 返回的 data.list 不是数组:', typeof response.data.list, response.data.list)
      break
    }
    
    // 处理当前页的数据
    if (response.data.list.length === 0) {
      console.log(`⚠️  Linkbux 第 ${currentPage}/${totalPages} 页为空`)
    } else {
      console.log(`📦 Linkbux 第 ${currentPage}/${totalPages} 页: ${response.data.list.length} 个订单`)
      
      // 调试：显示时间范围
      const firstTransaction = response.data.list[0]
      const lastTransaction = response.data.list[response.data.list.length - 1]
      const firstOrderTime = typeof firstTransaction.order_time === 'string'
        ? parseInt(firstTransaction.order_time, 10)
        : firstTransaction.order_time
      const lastOrderTime = typeof lastTransaction.order_time === 'string'
        ? parseInt(lastTransaction.order_time, 10)
        : lastTransaction.order_time
      console.log(`   🕐 时间范围: ${new Date(firstOrderTime * 1000).toISOString()} 至 ${new Date(lastOrderTime * 1000).toISOString()}`)
      
      // transaction_v2 返回的是扁平结构，每个 transaction 就是一条记录
      for (const transaction of response.data.list) {
        const transformed = transformLinkbuxToUnified(transaction, networkId, accountId)
        allCommissions.push(transformed)
      }
    }
    
    // 如果当前页是最后一页，跳出循环
    if (currentPage >= totalPages) {
      break
    }
    
    currentPage++
  }
  
  if (allCommissions.length > 0) {
    console.log('🔄 转换后的数据样本:', allCommissions[0])
  }
  console.log(`📊 Linkbux 展开共 ${allCommissions.length} 条记录`)
  
  return allCommissions
}

