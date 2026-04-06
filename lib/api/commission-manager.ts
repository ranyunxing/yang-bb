import type { 
  CommissionQueryParams, 
  CommissionSummary, 
  UnifiedCommission,
  NetworkConfig,
  NetworkAccount,
  NetworkType
} from '@/types'
import { getPartnermaticCommissions } from './networks/partnermatic'
import { getLinkhaitaoCommissions } from './networks/linkhaitao'
import { getLinkbuxCommissions } from './networks/linkbux'
import { supabaseServer } from '../supabase/server'

/**
 * 获取联盟配置
 */
async function getNetworkConfigs(networkIds?: string[]): Promise<NetworkConfig[]> {
  let query = supabaseServer
    .from('network_configs')
    .select('*')
    .eq('is_active', true)
  
  if (networkIds && networkIds.length > 0) {
    query = query.in('id', networkIds)
  }
  
  const { data, error } = await query
  
  if (error) throw error
  
  // 转换数据库字段名到 TypeScript 接口
  return (data || []).map((item: any) => ({
    id: item.id,
    name: item.name,
    type: item.type,
    apiUrl: item.api_url,
    merchantApiUrl: item.merchant_api_url || undefined,
    isActive: item.is_active,
    createdAt: item.created_at,
    updatedAt: item.updated_at
  }))
}

/**
 * 获取联盟账号配置
 */
async function getNetworkAccounts(
  networkIds?: string[],
  accountIds?: string[]
): Promise<NetworkAccount[]> {
  let query = supabaseServer
    .from('network_accounts')
    .select('*')
    .eq('is_active', true)
  
  if (networkIds && networkIds.length > 0) {
    query = query.in('network_id', networkIds)
  }
  
  if (accountIds && accountIds.length > 0) {
    query = query.in('id', accountIds)
  }
  
  const { data, error } = await query
  
  if (error) throw error
  
  // 转换数据库字段名到 TypeScript 接口
  return (data || []).map((item: any) => ({
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
 * 格式化日期为 YYYY-MM-DD
 */
function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 获取联盟类型对应的最大日期范围（天数）
 */
function getNetworkMaxDays(networkType: NetworkType): number {
  switch (networkType) {
    case 'partnermatic':
      return 62
    case 'linkhaitao':
      return 31
    case 'linkbux':
      return 31 // Linkbux API 限制：最多36个月，但单次查询建议31天
    default:
      return 62
  }
}

/**
 * 获取联盟类型对应的最大并发数
 */
function getNetworkMaxConcurrent(networkType: NetworkType): number {
  switch (networkType) {
    case 'partnermatic':
      return 3
    case 'linkhaitao':
      // Linkhaitao API 限制：2/5s，必须把并发压到 1，并配合批次延迟
      return 1
    case 'linkbux':
      return 3 // TODO: 根据实际 API 限制调整
    default:
      return 3
  }
}

/**
 * 拆分日期范围（用于API天数限制）
 * @param beginDate 开始日期 (YYYY-MM-DD)
 * @param endDate 结束日期 (YYYY-MM-DD)
 * @param maxDays 每个块的最大天数
 * @returns 日期块数组
 */
function splitDateRange(
  beginDate: string,
  endDate: string,
  maxDays: number
): Array<{ begin: string; end: string }> {
  const begin = new Date(beginDate)
  const end = new Date(endDate)
  const chunks: Array<{ begin: string; end: string }> = []
  
  let currentStart = new Date(begin)
  
  while (currentStart <= end) {
    const currentEnd = new Date(currentStart)
    currentEnd.setDate(currentEnd.getDate() + maxDays - 1) // maxDays-1 因为包含首尾两天
    
    // 确保不超过原始结束日期
    if (currentEnd > end) {
      currentEnd.setTime(end.getTime())
    }
    
    chunks.push({
      begin: formatDate(currentStart),
      end: formatDate(currentEnd)
    })
    
    // 下一个块的开始日期是当前块结束日期的下一天
    currentStart = new Date(currentEnd)
    currentStart.setDate(currentStart.getDate() + 1)
    
    // 防止无限循环
    if (chunks.length > 100) {
      throw new Error('日期范围拆分失败：块数过多（>100）')
    }
  }
  
  return chunks
}

/**
 * 批量执行任务函数，控制并发数
 * @param tasks 返回Promise的函数数组
 * @param maxConcurrent 最大并发数
 * @returns Promise.allSettled 结果数组
 */
async function batchExecute<T>(
  tasks: Array<() => Promise<T>>,
  maxConcurrent: number,
  options?: {
    batchDelayMs?: number
    networkName?: string
  }
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = []
  
  for (let i = 0; i < tasks.length; i += maxConcurrent) {
    const batch = tasks.slice(i, i + maxConcurrent)
    const batchIndex = Math.floor(i / maxConcurrent) + 1
    const totalBatches = Math.ceil(tasks.length / maxConcurrent)
    console.log(`  批次 ${batchIndex}/${totalBatches}: 执行 ${batch.length} 个任务`)
    
    // 执行函数获取Promise
    const batchPromises = batch.map(task => task())
    const batchResults = await Promise.allSettled(batchPromises)
    results.push(...batchResults)

    if (options?.batchDelayMs && i + maxConcurrent < tasks.length) {
      console.log(`  ⏳ ${options.networkName || '任务'} 批次 ${batchIndex} 完成，等待 ${options.batchDelayMs}ms 后继续...`)
      await delay(options.batchDelayMs)
    }
  }
  
  return results
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 获取业绩数据（统一入口）
 */
export async function getCommissions(
  params: CommissionQueryParams
): Promise<CommissionSummary> {
  const { 
    networkIds = [], 
    beginDate, 
    endDate, 
    curPage = 1, 
    perPage = 20,
    merchantName,
    mcid,
    status,
    paidStatus
  } = params
  
  // 1. 获取联盟配置
  const networks = await getNetworkConfigs(networkIds.length > 0 ? networkIds : undefined)
  if (networks.length === 0) {
    throw new Error('未找到有效的联盟配置')
  }
  
  // 2. 获取账号配置
  const accounts = await getNetworkAccounts(
    networkIds.length > 0 ? networkIds : undefined,
    params.accountIds
  )
  if (accounts.length === 0) {
    throw new Error('未找到有效的账号配置')
  }
  
  // 3. 按联盟分组账号
  const accountsByNetwork = new Map<string, NetworkAccount[]>()
  for (const account of accounts) {
    if (!accountsByNetwork.has(account.networkId)) {
      accountsByNetwork.set(account.networkId, [])
    }
    accountsByNetwork.get(account.networkId)!.push(account)
  }
  
  // 4. 计算日期差，按每个联盟的日期限制拆分并生成查询
  const begin = new Date(beginDate)
  const end = new Date(endDate)
  const daysDiff = Math.ceil((end.getTime() - begin.getTime()) / (1000 * 60 * 60 * 24)) + 1 // +1 因为包含首尾
  
  console.log(`📅 日期范围: ${beginDate} 至 ${endDate}，共 ${daysDiff} 天`)
  
  // 5. 按联盟类型拆分日期范围并按并发限制执行查询
  let allCommissions: UnifiedCommission[] = []
  const errors: string[] = []
  const warnings: string[] = []
  const infos: string[] = []
  let totalCalls = 0
  
  for (const network of networks) {
    const networkAccounts = accountsByNetwork.get(network.id) || []
    const maxDays = getNetworkMaxDays(network.type)
    const maxConcurrent = getNetworkMaxConcurrent(network.type)
    
    console.log(`🔗 联盟: ${network.name} (${network.type}), 账号数: ${networkAccounts.length}, 最大日期范围: ${maxDays}天, 最大并发: ${maxConcurrent}`)
    
    // 为当前联盟生成所有查询任务函数
    // 使用元组保存任务函数和对应的账号信息，以便统计时使用
    const networkTasks: Array<{
      task: () => Promise<UnifiedCommission[]>
      accountId: string
      accountName: string
      chunkInfo?: string
    }> = []
    
    // 判断是否需要拆分日期
    if (daysDiff > maxDays) {
      const chunkSize = network.type === 'linkhaitao' ? Math.min(maxDays, 30) : maxDays
      const chunks = splitDateRange(beginDate, endDate, chunkSize)
      console.log(`⚠️  ${network.name} 日期范围超过 ${maxDays} 天，拆分为 ${chunks.length} 个时间段`)
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]
        console.log(`📦 ${network.name} 时间段 ${i + 1}/${chunks.length}: ${chunk.begin} 至 ${chunk.end}`)
        
        for (const account of networkAccounts) {
          // 使用IIFE捕获循环变量，避免闭包问题
          const task = ((chunkIndex: number, currentChunk: typeof chunk, currentAccount: typeof account) => {
            return () => fetchCommissionByNetwork(
              network.type,
              network.id,
              currentAccount.id,
              currentAccount.token,
              currentChunk.begin,
              currentChunk.end,
              curPage,
              perPage
            ).then(commissions => {
              console.log(`✅ ${network.name}/${currentAccount.accountName} 时间段 ${chunkIndex + 1}/${chunks.length}: 获取 ${commissions.length} 条数据`, {
                accountId: currentAccount.id,
                beginDate: currentChunk.begin,
                endDate: currentChunk.end
              })
              return commissions
            }).catch(error => {
              console.error(`❌ ${network.name}/${currentAccount.accountName} 时间段 ${chunkIndex + 1}/${chunks.length} 查询失败:`, {
                accountId: currentAccount.id,
                beginDate: currentChunk.begin,
                endDate: currentChunk.end,
                error: error.message,
                stack: error.stack
              })
              throw error
            })
          })(i, chunk, account)
          
          networkTasks.push({
            task,
            accountId: account.id,
            accountName: account.accountName,
            chunkInfo: `时间段 ${i + 1}/${chunks.length} (${chunk.begin} 至 ${chunk.end})`
          })
        }
      }
    } else {
      // 日期范围在限制内，正常查询
      for (const account of networkAccounts) {
        console.log(`  👤 账号: ${account.accountName}, Token: ${account.token.substring(0, 8)}...`)
        const task = () => fetchCommissionByNetwork(
          network.type,
          network.id,
          account.id,
          account.token,
          beginDate,
          endDate,
          curPage,
          perPage
        )
        networkTasks.push({
          task,
          accountId: account.id,
          accountName: account.accountName
        })
      }
    }
    
    // 6. 对当前联盟的所有任务应用并发控制
    if (networkTasks.length > 0) {
      console.log(`🚀 ${network.name}: 开始分批执行 ${networkTasks.length} 个任务，每批 ${maxConcurrent} 个`)
      
      // 提取任务函数数组用于执行
      const taskFunctions = networkTasks.map(item => item.task)
      // Linkhaitao API 限制：2/5s，单任务批次之间延迟 3s，确保稳定不触发限流
      const linkhaitaoBatchDelay = network.type === 'linkhaitao' ? 3000 : undefined
      const networkResults = await batchExecute(taskFunctions, maxConcurrent, {
        batchDelayMs: linkhaitaoBatchDelay,
        networkName: network.name
      })
      
      // 统计每个账号的数据（包括空数据的时间段）
      const accountStats = new Map<string, { accountName: string; totalRecords: number; chunks: number; emptyChunks: number }>()
      
      for (let i = 0; i < networkResults.length; i++) {
        const result = networkResults[i]
        const taskInfo = networkTasks[i]
        
        if (result.status === 'fulfilled') {
          const commissions = result.value
          const beforeCount = allCommissions.length
          allCommissions = allCommissions.concat(commissions)
          const addedCount = allCommissions.length - beforeCount
          
          // 使用保存的账号信息进行统计（即使返回空数据也能统计）
          const accountId = taskInfo.accountId
          const accountName = taskInfo.accountName
          
          if (!accountStats.has(accountId)) {
            accountStats.set(accountId, { accountName, totalRecords: 0, chunks: 0, emptyChunks: 0 })
          }
          const stats = accountStats.get(accountId)!
          stats.totalRecords += addedCount
          stats.chunks += 1
          
          if (addedCount > 0) {
            console.log(`📈 ${network.name}/${accountName} (${accountId.substring(0, 8)}...): +${addedCount} 条数据${taskInfo.chunkInfo ? ` [${taskInfo.chunkInfo}]` : ''}`)
          } else {
            // 记录空数据的时间段
            stats.emptyChunks += 1
            console.log(`📭 ${network.name}/${accountName} (${accountId.substring(0, 8)}...): 0 条数据${taskInfo.chunkInfo ? ` [${taskInfo.chunkInfo}]` : ''}`)
          }
        } else {
          const reason = result.reason?.message || '未知错误'
          const errorDetails = result.reason
          errors.push(reason)
          console.error(`❌ ${network.name}/${taskInfo.accountName} API 调用失败:`, {
            accountId: taskInfo.accountId,
            chunkInfo: taskInfo.chunkInfo,
            reason,
            error: errorDetails,
            stack: errorDetails?.stack
          })
        }
      }
      
      // 打印账号汇总统计（包括空数据的时间段）
      if (accountStats.size > 0) {
        console.log(`📊 ${network.name} 账号数据统计:`)
        for (const [accountId, stats] of accountStats.entries()) {
          const totalChunks = stats.chunks
          const dataChunks = stats.chunks - stats.emptyChunks
          console.log(`   - ${stats.accountName} (${accountId.substring(0, 8)}...): ${stats.totalRecords} 条数据，共 ${totalChunks} 个时间段（${dataChunks} 个有数据，${stats.emptyChunks} 个为空）`)
          infos.push(`${network.name}/${stats.accountName}: ${stats.totalRecords} 条数据`)
        }
      }
      
      totalCalls += networkTasks.length
    }
  }
  
  console.log(`📊 总共合并了 ${allCommissions.length} 条数据（来自 ${totalCalls} 个 API 调用）`)
  
  // 按账号统计合并后的数据
  const finalAccountStats = new Map<string, { accountName: string; count: number }>()
  for (const commission of allCommissions) {
    const accountId = commission.accountId
    if (!finalAccountStats.has(accountId)) {
      const account = accounts.find(a => a.id === accountId)
      finalAccountStats.set(accountId, {
        accountName: account?.accountName || accountId,
        count: 0
      })
    }
    finalAccountStats.get(accountId)!.count++
  }
  
  if (finalAccountStats.size > 0) {
    console.log(`📊 合并后按账号统计:`)
    for (const [accountId, stats] of finalAccountStats.entries()) {
      console.log(`   - ${stats.accountName} (${accountId.substring(0, 8)}...): ${stats.count} 条数据`)
    }
  }
  
  // 如果有错误，记录日志但继续返回已有数据
  if (errors.length > 0) {
    console.warn(`⚠️  部分 API 调用失败 (${errors.length}/${totalCalls}):`, errors)
  }

  if (allCommissions.length > 0) {
    infos.push(`成功获取 ${allCommissions.length} 条业绩数据`)
  }
  
  // 8. 应用筛选
  let filteredCommissions = allCommissions
  
  if (merchantName) {
    const lowerMerchantName = merchantName.toLowerCase()
    filteredCommissions = filteredCommissions.filter(item => 
      item.merchantName?.toLowerCase().includes(lowerMerchantName)
    )
    console.log(`🔍 商家名称筛选 "${merchantName}": 剩余 ${filteredCommissions.length} 条`)
  }
  
  if (mcid) {
    const lowerMcid = mcid.toLowerCase()
    filteredCommissions = filteredCommissions.filter(item => 
      item.mcid?.toLowerCase().includes(lowerMcid)
    )
    console.log(`🔍 MCID 筛选 "${mcid}": 剩余 ${filteredCommissions.length} 条`)
  }
  
  if (status && status !== '全部') {
    filteredCommissions = filteredCommissions.filter(item => 
      item.status === status
    )
    console.log(`🔍 状态筛选 "${status}": 剩余 ${filteredCommissions.length} 条`)
  }
  
  if (paidStatus && paidStatus !== '全部') {
    const paidStatusNum = paidStatus === '已支付' ? 1 : 0
    filteredCommissions = filteredCommissions.filter(item => 
      item.paidStatus === paidStatusNum
    )
    console.log(`🔍 支付状态筛选 "${paidStatus}": 剩余 ${filteredCommissions.length} 条`)
  }
  
  // 9. 数据返回（不再进行截断，始终返回所有数据）
  // 前端有自己的分页逻辑，后端应该返回完整数据，让前端自行处理分页显示
  const total = filteredCommissions.length
  
  // 始终返回所有数据，不进行截断
  // 前端会根据需要进行筛选和分页显示
  console.log(`📄 返回所有数据（${total} 条），前端自行处理分页显示`)
  
  // 计算汇总（基于筛选后的数据）
  const summary = calculateSummary(filteredCommissions, networks, accounts)
  
  return {
    total,
    curPage: 1, // 后端不再分页，始终返回第1页的概念
    totalPage: 1, // 后端不再分页，总页数为1
    hasNext: false, // 后端不再分页，没有下一页的概念
    data: filteredCommissions, // 返回所有数据，不截断
    summary,
    meta: {
      success: errors.length === 0,
      errors,
      warnings,
      infos,
    },
  }
}

/**
 * 根据联盟类型调用对应的 API
 */
async function fetchCommissionByNetwork(
  networkType: NetworkType,
  networkId: string,
  accountId: string,
  token: string,
  beginDate: string,
  endDate: string,
  curPage: number,
  perPage: number
): Promise<UnifiedCommission[]> {
  switch (networkType) {
    case 'partnermatic':
      return await getPartnermaticCommissions(
        {
          source: 'partnermatic',
          token,
          dataScope: 'user',
          beginDate,
          endDate,
          curPage,
          perPage,
        },
        networkId,
        accountId
      )
    
    case 'linkhaitao':
      return await getLinkhaitaoCommissions(
        {
          source: 'linkhaitao',
          token,
          beginDate,
          endDate,
          curPage,
          perPage,
        },
        networkId,
        accountId
      )
    
    case 'linkbux':
      return await getLinkbuxCommissions(
        {
          source: 'linkbux',
          token,
          // 使用 transaction_v2 API，使用 begin_date/end_date 参数
          beginDate,
          endDate,
          page: curPage,
          limit: perPage,
        },
        networkId,
        accountId
      )
    
    default:
      throw new Error(`不支持的联盟类型: ${networkType}`)
  }
}

/**
 * 计算汇总数据
 */
function calculateSummary(
  commissions: UnifiedCommission[],
  networks: NetworkConfig[],
  accounts: NetworkAccount[]
) {
  const summary = {
    totalAmount: 0,
    totalCommission: 0,
    networks: {} as Record<string, {
      networkName?: string
      amount: number
      commission: number
      accounts: Record<string, {
        accountName?: string
        amount: number
        commission: number
      }>
    }>,
  }
  
  console.log('📊 开始计算汇总，数据条数:', commissions.length)
  
  if (commissions.length > 0) {
    console.log('📊 第一条数据示例:', {
      saleAmount: commissions[0].saleAmount,
      commission: commissions[0].commission,
      orderId: commissions[0].orderId,
      merchantName: commissions[0].merchantName
    })
  }
  
  // 创建 ID 到名称的映射
  const networkMap = new Map(networks.map(n => [n.id, n.name]))
  const accountMap = new Map(accounts.map(a => [a.id, a.accountName]))
  
  for (const commission of commissions) {
    const amount = commission.saleAmount || 0
    const comm = commission.commission || 0
    
    summary.totalAmount += amount
    summary.totalCommission += comm
    
    const networkId = commission.networkId
    const accountId = commission.accountId
    
    // 初始化网络
    if (!summary.networks[networkId]) {
      summary.networks[networkId] = {
        networkName: networkMap.get(networkId),
        amount: 0,
        commission: 0,
        accounts: {}
      }
    }
    
    // 初始化账号
    if (!summary.networks[networkId].accounts[accountId]) {
      summary.networks[networkId].accounts[accountId] = {
        accountName: accountMap.get(accountId),
        amount: 0,
        commission: 0
      }
    }
    
    // 累加网络
    summary.networks[networkId].amount += amount
    summary.networks[networkId].commission += comm
    
    // 累加账号
    summary.networks[networkId].accounts[accountId].amount += amount
    summary.networks[networkId].accounts[accountId].commission += comm
  }
  
  console.log('📊 汇总结果:', {
    totalAmount: summary.totalAmount,
    totalCommission: summary.totalCommission,
    networks: Object.keys(summary.networks).length
  })
  
  return summary
}

