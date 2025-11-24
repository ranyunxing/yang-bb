import { supabaseServer } from '../supabase/server'
import { getAllPartnermaticMerchants } from './networks/partnermatic-merchants'
import { getAllNetworks } from './networks'
import { extractDomainFromUrl, buildDomainSearch } from '../utils/url'
import type { NetworkAccount, NetworkConfig, Merchant, MerchantSyncResult, PartnermaticMerchant } from '@/types'

/**
 * 获取所有活跃的联盟账号
 */
export async function getAllActiveAccounts(): Promise<NetworkAccount[]> {
  const { data, error } = await supabaseServer
    .from('network_accounts')
    .select('*')
    .eq('is_active', true)
    .order('account_name', { ascending: true })
  
  if (error) {
    console.error('获取账号列表失败:', error)
    throw error
  }
  
  // 转换数据库字段名到 TypeScript 接口
  return (data || []).map(item => ({
    id: item.id,
    networkId: item.network_id,
    token: item.token,
    accountName: item.account_name,
    isActive: item.is_active,
    createdAt: item.created_at,
    updatedAt: item.updated_at
  }))
}

/**
 * 将 API 返回的广告商数据转换为数据库格式
 */
function transformMerchantToDb(
  apiMerchant: PartnermaticMerchant,
  networkId: string,
  accountId: string
): Omit<Merchant, 'id' | 'createdAt' | 'updatedAt'> {
  const website = apiMerchant.site_url || undefined
  const websiteDomain = extractDomainFromUrl(website)

  return {
    name: apiMerchant.merchant_name || '',
    website,
    websiteDomain: websiteDomain || undefined,
    networkId,
    accountId,
    mcid: apiMerchant.mcid || undefined,
    brandId: apiMerchant.brand_id || undefined,
    offerType: apiMerchant.offer_type || undefined,
    country: apiMerchant.country || undefined,
    supportRegion: apiMerchant.support_region || undefined,
    relationship: apiMerchant.relationship || undefined,
    trackingUrlShort: apiMerchant.tracking_url_short || undefined,
  }
}

/**
 * 批量插入广告商数据到数据库
 * @param merchants 广告商数据数组
 * @param batchSize 每批插入的数量
 */
async function batchInsertMerchants(
  merchants: Array<Omit<Merchant, 'id' | 'createdAt' | 'updatedAt'>>,
  batchSize: number = 1500
): Promise<number> {
  if (merchants.length === 0) {
    return 0
  }
  
  let insertedCount = 0
  
  // 分批插入
  for (let i = 0; i < merchants.length; i += batchSize) {
    const batch = merchants.slice(i, i + batchSize)
    
    // 转换为数据库字段格式
    const dbRecords = batch.map(merchant => ({
      name: merchant.name,
      website: merchant.website || null,
      website_domain: merchant.websiteDomain || null,
      network_id: merchant.networkId || null,
      account_id: merchant.accountId || null,
      mcid: merchant.mcid || null,
      brand_id: merchant.brandId || null,
      offer_type: merchant.offerType || null,
      country: merchant.country || null,
      support_region: merchant.supportRegion || null,
      relationship: merchant.relationship || null,
      tracking_url_short: merchant.trackingUrlShort || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }))
    
    const { error } = await supabaseServer
      .from('merchants')
      .insert(dbRecords)
    
    if (error) {
      console.error(`批量插入第 ${Math.floor(i / batchSize) + 1} 批失败:`, error)
      throw error
    }
    
    insertedCount += batch.length
    console.log(`✅ 已插入 ${insertedCount}/${merchants.length} 条广告商数据`)
  }
  
  return insertedCount
}

/**
 * 同步所有账号的广告商数据
 * @param maxConcurrent 最大并发数
 */
export async function syncAllMerchants(): Promise<MerchantSyncResult> {
  console.log('🚀 开始同步所有广告商数据...')
  
  // 1. 获取所有活跃账号
  const accounts = await getAllActiveAccounts()
  console.log(`📋 找到 ${accounts.length} 个活跃账号`)
  
  if (accounts.length === 0) {
    return {
      success: false,
      totalAccounts: 0,
      successAccounts: 0,
      failedAccounts: 0,
      totalMerchants: 0,
      errors: [{
        accountId: '',
        accountName: '',
        error: '没有找到活跃的账号'
      }]
    }
  }
  
  // 2. 获取所有联盟配置，用于判断联盟类型和获取 API URL
  const networks = await getAllNetworks()
  const networkMap = new Map<string, NetworkConfig>()
  networks.forEach(network => {
    networkMap.set(network.id, network)
  })
  
  // 3. 只处理 Partnermatic 联盟的账号（目前只支持 Partnermatic）
  const partnermaticAccounts = accounts.filter(account => {
    const network = networkMap.get(account.networkId)
    return network?.type === 'partnermatic'
  })
  
  if (partnermaticAccounts.length === 0) {
    return {
      success: false,
      totalAccounts: accounts.length,
      successAccounts: 0,
      failedAccounts: 0,
      totalMerchants: 0,
      errors: [{
        accountId: '',
        accountName: '',
        error: '没有找到 Partnermatic 联盟的账号'
      }]
    }
  }
  
  // 验证所有账号都有对应的广告商 API URL
  const accountsWithoutApiUrl = partnermaticAccounts.filter(account => {
    const network = networkMap.get(account.networkId)
    return !network?.merchantApiUrl
  })
  
  if (accountsWithoutApiUrl.length > 0) {
    return {
      success: false,
      totalAccounts: accounts.length,
      successAccounts: 0,
      failedAccounts: accountsWithoutApiUrl.length,
      totalMerchants: 0,
      errors: accountsWithoutApiUrl.map(account => ({
        accountId: account.id,
        accountName: account.accountName,
        error: '联盟配置中缺少广告商 API URL (merchant_api_url)'
      }))
    }
  }
  
  // 4. 顺序获取每个账号的广告商数据
  const results: Array<{
    account: NetworkAccount
    merchants: PartnermaticMerchant[]
    error?: string
  }> = []

  for (const account of partnermaticAccounts) {
    const network = networkMap.get(account.networkId)

    if (!network?.merchantApiUrl) {
      const errorMessage = '联盟配置中缺少广告商 API URL (merchant_api_url)'
      console.error(`❌ 账号 "${account.accountName}" 配置错误: ${errorMessage}`)
      results.push({ account, merchants: [], error: errorMessage })
      continue
    }

    try {
      console.log(`📡 正在获取账号 "${account.accountName}" 的广告商数据...`)
      const merchants = await getAllPartnermaticMerchants(
        account.token,
        account.networkId,
        account.id,
        network.merchantApiUrl,
        {
          perPage: 100,
          delayMs: 100,
          timeoutMs: 120_000,
          maxRetries: 3,
        }
      )
      console.log(`✅ 账号 "${account.accountName}" 获取成功: ${merchants.length} 个广告商`)
      results.push({ account, merchants })
    } catch (error: any) {
      const errorMessage = error?.message || '未知错误'
      console.error(`❌ 账号 "${account.accountName}" 获取失败:`, errorMessage)
      results.push({ account, merchants: [], error: errorMessage })
    }
  }
  
  // 5. 统计结果
  const successResults = results.filter(r => !r.error)
  const failedResults = results.filter(r => r.error)
  const apiMerchants: PartnermaticMerchant[] = []
  
  successResults.forEach(r => {
    apiMerchants.push(...r.merchants)
  })
  
  console.log(`📊 同步统计: 成功 ${successResults.length} 个账号, 失败 ${failedResults.length} 个账号, 共 ${apiMerchants.length} 个广告商`)
  
  // 6. 转换数据格式并准备插入数据库
  let totalInserted = 0
  const errors: MerchantSyncResult['errors'] = []

  for (const result of successResults) {
    const merchantRecords = result.merchants.map(merchant =>
      transformMerchantToDb(merchant, result.account.networkId, result.account.id)
    )

    try {
      console.log(`🗑️  删除账号 "${result.account.accountName}" 旧的广告商数据...`)
      const { error: deleteError } = await supabaseServer
        .from('merchants')
        .delete()
        .eq('account_id', result.account.id)

      if (deleteError) {
        throw new Error(`删除旧数据失败: ${deleteError.message}`)
      }

      if (merchantRecords.length > 0) {
        console.log(`📥 插入账号 "${result.account.accountName}" 的 ${merchantRecords.length} 条广告商数据...`)
        const inserted = await batchInsertMerchants(merchantRecords, 1500)
        totalInserted += inserted
        console.log(`✅ 账号 "${result.account.accountName}" 插入完成: ${inserted} 条`)
      } else {
        console.log(`ℹ️  账号 "${result.account.accountName}" 没有广告商数据，跳过插入`)
      }
    } catch (error: any) {
      const message = error?.message || '未知错误'
      console.error(`❌ 账号 "${result.account.accountName}" 写入失败:`, message)
      errors.push({
        accountId: result.account.id,
        accountName: result.account.accountName,
        error: `写入失败: ${message}`
      })
    }
  }

  errors.push(...failedResults.map(r => ({
    accountId: r.account.id,
    accountName: r.account.accountName,
    error: r.error || '未知错误'
  })))

  const success = successResults.length > 0 && errors.length === 0

  return {
    success,
    totalAccounts: accounts.length,
    successAccounts: successResults.length,
    failedAccounts: failedResults.length,
    totalMerchants: totalInserted,
    errors,
  }
}

/**
 * 搜索广告商
 */
export async function searchMerchants(params: {
  query?: string
  networkId?: string
  accountId?: string
  limit?: number
  offset?: number
}): Promise<{
  merchants: Merchant[]
  total: number
}> {
  let query = supabaseServer
    .from('merchants_view')
    .select('*', { count: 'exact' })
  
  // 搜索关键词（匹配 name, website, website_domain, mcid, brand_id, tracking_url_short）
  if (params.query) {
    const searchQuery = params.query.trim()
    const domainSearch = buildDomainSearch(searchQuery)
    const conditions = [
      `merchant_name.ilike.%${searchQuery}%`,
      `website.ilike.%${searchQuery}%`,
      `mcid.ilike.%${searchQuery}%`,
      `brand_id.ilike.%${searchQuery}%`,
      `tracking_url_short.ilike.%${searchQuery}%`
    ]

    if (domainSearch.equals) {
      conditions.push(`website_domain.eq.${domainSearch.equals}`)
    } else if (domainSearch.prefix) {
      conditions.push(`website_domain.ilike.${domainSearch.prefix}%`)
    }

    query = query.or(conditions.join(','))
  }
  
  // 过滤联盟
  if (params.networkId) {
    query = query.eq('network_id', params.networkId)
  }
  
  // 过滤账号
  if (params.accountId) {
    query = query.eq('account_id', params.accountId)
  }
  
  // 分页
  const limit = params.limit || 50
  const offset = params.offset || 0
  query = query.range(offset, offset + limit - 1)
  
  // 排序
  query = query.order('merchant_name', { ascending: true })
  
  const { data, error, count } = await query
  
  if (error) {
    console.error('搜索广告商失败:', error)
    throw error
  }
  
  // 转换数据库字段名到 TypeScript 接口
  const merchants: Merchant[] = (data || []).map(item => ({
    id: item.id,
    name: item.merchant_name,
    website: item.website || undefined,
    websiteDomain: item.website_domain || undefined,
    networkId: item.network_id,
    accountId: item.account_id,
    mcid: item.mcid || undefined,
    brandId: item.brand_id || undefined,
    offerType: item.offer_type || undefined,
    country: item.country || undefined,
    supportRegion: item.support_region || undefined,
    relationship: item.relationship || undefined,
    trackingUrlShort: item.tracking_url_short || undefined,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    networkName: item.network_name,
    accountName: item.account_name,
  }))
  
  return {
    merchants,
    total: count || 0
  }
}

