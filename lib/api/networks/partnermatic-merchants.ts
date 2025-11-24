import axios from 'axios'
import type { 
  PartnermaticMerchantRequest, 
  PartnermaticMerchantResponse,
  PartnermaticMerchant
} from '@/types'

const DEFAULT_TIMEOUT_MS = 120_000
const DEFAULT_DELAY_MS = 100
const DEFAULT_MAX_RETRIES = 3

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Partnermatic 广告商 API 调用
 * 获取指定账号的所有广告商列表
 */
export async function fetchPartnermaticMerchants(
  request: PartnermaticMerchantRequest,
  apiUrl: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<PartnermaticMerchantResponse> {
  console.log('📡 Partnermatic 广告商 API 请求:', {
    apiUrl,
    curPage: request.curPage || 1,
    perPage: request.perPage || 100,
    token: request.token.substring(0, 8) + '...',
    source: request.source
  })
  
  try {
    const response = await axios.post<PartnermaticMerchantResponse>(
      apiUrl,
      request,
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: timeoutMs,
      }
    )
    
    console.log('✅ Partnermatic 广告商 API 响应:', {
      code: response.data.code,
      message: response.data.message,
      total: response.data.data?.total_mcid || 0
    })
    
    return response.data
  } catch (error: any) {
    // 处理 axios 错误
    if (error.response) {
      // API 返回了错误响应
      console.error('❌ Partnermatic 广告商 API HTTP 错误:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      })
      throw new Error(`Partnermatic 广告商 API HTTP 错误: ${error.response.status} - ${error.response.statusText}`)
    } else if (error.request) {
      // 请求发送但无响应
      console.error('❌ Partnermatic 广告商 API 无响应:', error.request)
      throw new Error('Partnermatic 广告商 API 请求超时或无响应')
    } else {
      // 其他错误
      console.error('❌ Partnermatic 广告商 API 请求错误:', error.message)
      throw new Error(`Partnermatic 广告商 API 请求错误: ${error.message}`)
    }
  }
}

/**
 * 获取所有广告商（自动处理分页）
 * @param token API token
 * @param networkId 联盟ID
 * @param accountId 账号ID
 * @param apiUrl 广告商 API URL（从数据库读取）
 * @returns 广告商列表
 */
export async function getAllPartnermaticMerchants(
  token: string,
  networkId: string,
  accountId: string,
  apiUrl: string,
  options?: {
    perPage?: number
    delayMs?: number
    timeoutMs?: number
    maxRetries?: number
  }
): Promise<PartnermaticMerchant[]> {
  let allMerchants: PartnermaticMerchant[] = []
  let currentPage = 1
  let totalPages = 1
  let firstResponse = true
  const perPage = options?.perPage ?? 100 // 每页100条
  const delayMs = options?.delayMs ?? DEFAULT_DELAY_MS
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES
  
  console.log(`📄 Partnermatic 广告商分页获取开始: networkId=${networkId}, accountId=${accountId}`)
  
  // 循环获取所有页面的数据
  while (true) {
    const request: PartnermaticMerchantRequest = {
      source: 'partnermatic',
      token,
      curPage: currentPage,
      perPage,
      // 不传 relationship，获取所有状态的广告商
    }
    
    let response: PartnermaticMerchantResponse | null = null
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        response = await fetchPartnermaticMerchants(request, apiUrl, timeoutMs)
        break
      } catch (error: any) {
        if (attempt >= maxRetries) {
          console.error(`❌ Partnermatic 广告商第 ${currentPage} 页请求失败，已尝试 ${attempt} 次`, error?.message || error)
          throw error
        }
        const backoff = delayMs * Math.pow(2, attempt - 1)
        console.warn(`⚠️  Partnermatic 广告商第 ${currentPage} 页请求失败，${backoff}ms 后重试（第 ${attempt}/${maxRetries} 次）`)
        await delay(backoff)
      }
    }

    if (!response) {
      throw new Error(`Partnermatic 广告商第 ${currentPage} 页请求始终失败`)
    }
    
    if (response.code !== '0') {
      throw new Error(`Partnermatic 广告商 API 错误: ${response.message}`)
    }
    
    // 防御性检查：确保 data 存在
    if (!response.data) {
      if (firstResponse) {
        console.warn('⚠️  Partnermatic 广告商 API 返回的 data 字段不存在')
        return []
      }
      break
    }
    
    // 第一次请求时记录总页数
    if (firstResponse) {
      totalPages = response.data.total_page || 1
      const actualTotal = response.data.total_mcid || 0
      
      console.log(`📄 Partnermatic 广告商总共 ${totalPages} 页数据需要获取（总记录数: ${actualTotal}，每页: ${perPage}）`)
      firstResponse = false
      
      // 如果总页数为0或总记录数为0，直接返回
      if (totalPages === 0 || actualTotal === 0) {
        console.log('⚠️  Partnermatic 广告商总页数为0或总记录数为0，没有数据')
        return []
      }
    }
    
    // 检查 data.list 是否为数组
    if (!Array.isArray(response.data.list)) {
      console.error('❌ Partnermatic 广告商 API 返回的 data.list 不是数组:', {
        type: typeof response.data.list,
        value: response.data.list,
        total: response.data.total_mcid,
        hasData: !!response.data
      })
      break
    }
    
    // 处理当前页的数据
    const currentPageDataCount = response.data.list.length
    if (currentPageDataCount === 0) {
      console.log(`⚠️  Partnermatic 广告商第 ${currentPage}/${totalPages} 页为空`)
      // 如果当前页为空且不是第一页，说明已经获取完所有数据
      if (currentPage > 1) {
        break
      }
    } else {
      if (currentPage === 1) {
        console.log('📦 Partnermatic 广告商原始数据样本:', response.data.list[0])
      }
      
      allMerchants = allMerchants.concat(response.data.list)
      
      const progress = ((currentPage / totalPages) * 100).toFixed(1)
      console.log(`📦 Partnermatic 广告商第 ${currentPage}/${totalPages} 页: ${currentPageDataCount} 条数据 (${progress}%)`)
      
      // 如果当前页返回的数据量小于perPage，说明这是最后一页
      if (currentPageDataCount < perPage) {
        console.log(`✅ Partnermatic 广告商第 ${currentPage} 页返回 ${currentPageDataCount} 条数据 < perPage ${perPage}，这是最后一页`)
        break
      }
    }
    
    // 检查是否还有下一页
    if (currentPage >= totalPages) {
      console.log(`✅ Partnermatic 广告商已获取所有页面（当前页 ${currentPage} >= 总页数 ${totalPages}）`)
      break
    }
    
    currentPage++
    
    // 安全限制：防止无限循环
    if (currentPage > 1000) {
      console.warn(`⚠️  Partnermatic 广告商分页循环超过1000页，强制停止`)
      break
    }
    
    // 添加小延迟避免API限制
    await delay(delayMs)
  }
  
  console.log(`✅ Partnermatic 广告商总共获取 ${allMerchants.length} 条数据（来自 ${totalPages} 页）`)
  
  return allMerchants
}

