'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { CommissionSummary, NetworkConfig, NetworkAccount } from '@/types'
import CommissionReport from './CommissionReport'
import CommissionChartToggle from './CommissionChartToggle'
import DebugPanel from './DebugPanel'
import styles from './CommissionMonitor.module.css'

export default function CommissionMonitor() {
  const [networks, setNetworks] = useState<NetworkConfig[]>([])
  const [accounts, setAccounts] = useState<NetworkAccount[]>([])
  const [selectedNetworkIds, setSelectedNetworkIds] = useState<string[]>([])
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([])
  const [beginDate, setBeginDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingNetworks, setLoadingNetworks] = useState(false)
  const [data, setData] = useState<CommissionSummary | null>(null)
  const [error, setError] = useState('')
  const [activeDatePreset, setActiveDatePreset] = useState<string>('')
  // 筛选状态
  const [filterMerchantName, setFilterMerchantName] = useState('')
  const [filterMcid, setFilterMcid] = useState('')
  const [filterBrandId, setFilterBrandId] = useState('')
  const [filterStatus, setFilterStatus] = useState('全部')
  const [filterPaidStatus, setFilterPaidStatus] = useState('全部')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [pageInputValue, setPageInputValue] = useState('')
  const [expandedNetworks, setExpandedNetworks] = useState<Set<string>>(new Set())
  const [expandedAccounts, setExpandedAccounts] = useState<Map<string, Set<string>>>(new Map())
  const [isMerchantSummaryExpanded, setIsMerchantSummaryExpanded] = useState(true)
  // 时间排序状态：'asc' 升序, 'desc' 降序, null 无排序
  const [timeSortOrder, setTimeSortOrder] = useState<'asc' | 'desc' | null>(null)
  // 佣金展开状态
  const [isCommissionExpanded, setIsCommissionExpanded] = useState(false)
  // 图表显示状态
  const [isChartsVisible, setIsChartsVisible] = useState(false)
  // 悬停的商家名称和位置（用于显示tooltip）
  const [hoveredMerchant, setHoveredMerchant] = useState<string | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number } | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [successMessage, setSuccessMessage] = useState('')
  const [warningMessage, setWarningMessage] = useState('')
  
  // 处理滚动，隐藏tooltip
  useEffect(() => {
    const handleScroll = () => {
      if (hoveredMerchant) {
        setHoveredMerchant(null)
        setTooltipPosition(null)
      }
    }
    
    window.addEventListener('scroll', handleScroll, true)
    return () => {
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [hoveredMerchant])
  
  // 加载联盟列表和账号列表
  useEffect(() => {
    const loadData = async () => {
      setLoadingNetworks(true)
      try {
        // 加载联盟列表
        const networksResponse = await fetch('/api/networks')
        if (!networksResponse.ok) throw new Error('获取联盟列表失败')
        const networksData = await networksResponse.json()
        setNetworks(networksData)
        
        // 加载账号列表
        const accountsResponse = await fetch('/api/accounts')
        if (!accountsResponse.ok) throw new Error('获取账号列表失败')
        const accountsData = await accountsResponse.json()
        setAccounts(accountsData)
      } catch (err: any) {
        console.error('加载数据失败:', err)
        setError(err.message || '加载数据失败')
      } finally {
        setLoadingNetworks(false)
      }
    }
    loadData()
  }, [])
  
  // 日期快速选择函数
  const setDatePreset = (preset: string) => {
    const today = new Date()
    let startDate: Date
    let endDate: Date = new Date(today)
    
    switch (preset) {
      case 'today':
        startDate = new Date(today)
        endDate = new Date(today)
        break
      case 'yesterday':
        startDate = new Date(today)
        startDate.setDate(today.getDate() - 1)
        endDate = new Date(startDate)
        break
      case 'last7days':
        startDate = new Date(today)
        startDate.setDate(today.getDate() - 6) // 近7天：今天+往前6天 = 7天
        break
      case 'last30days':
        startDate = new Date(today)
        startDate.setDate(today.getDate() - 29) // 近30天：今天+往前29天 = 30天
        break
      case 'last180days':
        startDate = new Date(today)
        startDate.setDate(today.getDate() - 179) // 近180天：今天+往前179天 = 180天
        break
      case 'lastYear':
        startDate = new Date(today)
        startDate.setDate(today.getDate() - 364) // 近一年：今天+往前364天 = 365天
        break
      case 'thisMonth':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1)
        endDate = new Date(today)
        break
      case 'lastMonth':
        // 上个月的第一天
        startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        // 上个月的最后一天（当前月的第0天）
        endDate = new Date(today.getFullYear(), today.getMonth(), 0)
        break
      default:
        return
    }
    
    // 使用本地时区格式化日期，避免时区偏移问题
    const formatDate = (date: Date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
    
    setBeginDate(formatDate(startDate))
    setEndDate(formatDate(endDate))
    setActiveDatePreset(preset)
  }
  
  const handleQuery = async () => {
    if (!beginDate || !endDate) {
      setError('请选择日期范围')
      return
    }
    
    setLoading(true)
    setError('')
    setSuccessMessage('')
    setWarningMessage('')
    
    try {
      const response = await fetch('/api/commissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          networkIds: selectedNetworkIds.length > 0 ? selectedNetworkIds : undefined,
          accountIds: selectedAccountIds.length > 0 ? selectedAccountIds : undefined,
          beginDate,
          endDate,
          curPage: 1,
          perPage: 2000, // 获取所有数据用于可视化分析
          merchantName: undefined,
          mcid: undefined,
          status: undefined,
          paidStatus: undefined,
        }),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '查询失败')
      }
      
      const result = await response.json()
      setData(result)
      setCurrentPage(1) // 查询成功后重置到第一页

      const meta = result?.meta
      if (meta) {
        const metaErrors: string[] = Array.isArray(meta.errors) ? meta.errors.filter(Boolean) : []
        const metaWarnings: string[] = Array.isArray(meta.warnings) ? meta.warnings.filter(Boolean) : []
        const metaInfos: string[] = Array.isArray(meta.infos) ? meta.infos.filter(Boolean) : []

        if (!meta.success) {
          const errorMsg = metaErrors.length > 0 ? metaErrors.join('；') : '查询失败'
          setError(errorMsg)
          setSuccessMessage('')
          setWarningMessage('')
        } else {
          setError('')
          const infoMsg = metaInfos.length > 0 ? metaInfos.join('；') : `查询成功，共 ${result.total} 条数据`
          setSuccessMessage(infoMsg)
          const warningMsg = metaWarnings.length > 0 ? metaWarnings.join('；') : ''
          setWarningMessage(warningMsg)
        }
      } else {
        setError('')
        setSuccessMessage(`查询成功，共 ${result.total} 条数据`)
        setWarningMessage('')
      }
    } catch (err: any) {
      setError(err.message || '查询失败')
      setData(null)
      setSuccessMessage('')
      setWarningMessage('')
    } finally {
      setLoading(false)
    }
  }
  
  // 前端筛选和分页逻辑
  const filteredAndPaginatedData = useMemo(() => {
    if (!data?.data) return { list: [], total: 0, totalPages: 0 }
    
    // 应用筛选
    let filtered = data.data.filter(item => {
      if (filterMerchantName && !item.merchantName?.toLowerCase().includes(filterMerchantName.toLowerCase())) {
        return false
      }
      if (filterMcid && !item.mcid?.toLowerCase().includes(filterMcid.toLowerCase())) {
        return false
      }
      if (filterBrandId && !item.brandId?.toLowerCase().includes(filterBrandId.toLowerCase())) {
        return false
      }
      if (filterStatus !== '全部' && item.status !== filterStatus) {
        return false
      }
      if (filterPaidStatus !== '全部') {
        const paidStatusNum = filterPaidStatus === '已支付' ? 1 : 0
        if (item.paidStatus !== paidStatusNum) {
          return false
        }
      }
      return true
    })
    
    // 应用时间排序
    if (timeSortOrder) {
      filtered = [...filtered].sort((a, b) => {
        const timeA = a.orderTime || 0
        const timeB = b.orderTime || 0
        if (timeSortOrder === 'asc') {
          return timeA - timeB
        } else {
          return timeB - timeA
        }
      })
    }
    
    // 应用分页
    const total = filtered.length
    const totalPages = Math.ceil(total / pageSize)
    const startIndex = (currentPage - 1) * pageSize
    const endIndex = startIndex + pageSize
    const paginated = filtered.slice(startIndex, endIndex)
    
    return { list: paginated, total, totalPages }
  }, [data?.data, filterMerchantName, filterMcid, filterBrandId, filterStatus, filterPaidStatus, timeSortOrder, currentPage, pageSize])
  
  // 计算筛选后的统计数据
  const filteredStats = useMemo(() => {
    if (!data?.data) return { totalAmount: 0, totalCommission: 0, statusCounts: {} as Record<string, number>, statusCommissions: {} as Record<string, number> }
    
    const filtered = data.data.filter(item => {
      if (filterMerchantName && !item.merchantName?.toLowerCase().includes(filterMerchantName.toLowerCase())) {
        return false
      }
      if (filterMcid && !item.mcid?.toLowerCase().includes(filterMcid.toLowerCase())) {
        return false
      }
      if (filterBrandId && !item.brandId?.toLowerCase().includes(filterBrandId.toLowerCase())) {
        return false
      }
      if (filterStatus !== '全部' && item.status !== filterStatus) {
        return false
      }
      if (filterPaidStatus !== '全部') {
        const paidStatusNum = filterPaidStatus === '已支付' ? 1 : 0
        if (item.paidStatus !== paidStatusNum) {
          return false
        }
      }
      return true
    })
    
    const totalAmount = filtered.reduce((sum, item) => sum + (item.saleAmount || 0), 0)
    const totalCommission = filtered.reduce((sum, item) => sum + (item.commission || 0), 0)
    
    const statusCounts = filtered.reduce((acc, item) => {
      const status = item.status || 'Unknown'
      acc[status] = (acc[status] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    // 按状态计算佣金金额
    const statusCommissions = filtered.reduce((acc, item) => {
      const status = item.status || 'Unknown'
      acc[status] = (acc[status] || 0) + (item.commission || 0)
      return acc
    }, {} as Record<string, number>)
    
    return { totalAmount, totalCommission, statusCounts, statusCommissions }
  }, [data?.data, filterMerchantName, filterMcid, filterBrandId, filterStatus, filterPaidStatus])
  
  // 计算筛选结果中的商家信息列表（MCID和品牌ID）
  const filteredMerchantInfo = useMemo(() => {
    // 只在筛选状态时（非"全部"）才计算
    if (!data?.data || filterStatus === '全部') return []
    
    // 应用所有筛选条件获取筛选后的数据
    const filtered = data.data.filter(item => {
      if (filterMerchantName && !item.merchantName?.toLowerCase().includes(filterMerchantName.toLowerCase())) {
        return false
      }
      if (filterMcid && !item.mcid?.toLowerCase().includes(filterMcid.toLowerCase())) {
        return false
      }
      if (filterBrandId && !item.brandId?.toLowerCase().includes(filterBrandId.toLowerCase())) {
        return false
      }
      if (filterStatus !== '全部' && item.status !== filterStatus) {
        return false
      }
      if (filterPaidStatus !== '全部') {
        const paidStatusNum = filterPaidStatus === '已支付' ? 1 : 0
        if (item.paidStatus !== paidStatusNum) {
          return false
        }
      }
      return true
    })
    
    // 提取MCID和品牌ID并去重（按MCID）
    const merchantMap = new Map<string, { mcid: string; brandId: string; merchantName: string }>()
    filtered.forEach(item => {
      const mcid = item.mcid || ''
      if (mcid) {
        if (!merchantMap.has(mcid)) {
          merchantMap.set(mcid, {
            mcid,
            brandId: item.brandId || '-',
            merchantName: item.merchantName || '未知商家'
          })
        }
      }
    })
    
    return Array.from(merchantMap.values()).sort((a, b) => a.mcid.localeCompare(b.mcid))
  }, [data?.data, filterMerchantName, filterMcid, filterBrandId, filterStatus, filterPaidStatus])
  
  // 计算每个商家的状态统计（基于当前日期范围内的全部数据，不应用任何筛选条件）
  const merchantStatusStats = useMemo(() => {
    if (!data?.data) return {} as Record<string, { Pending: number; Rejected: number; Approved: number }>
    
    // 直接基于 data.data 计算，不应用任何前端筛选条件
    // data.data 已经包含了日期范围筛选（由API完成）
    const stats = data.data.reduce((acc, item) => {
      const merchant = item.merchantName || 'Unknown'
      if (!acc[merchant]) {
        acc[merchant] = { Pending: 0, Rejected: 0, Approved: 0 }
      }
      const status = item.status || 'Unknown'
      if (status === 'Pending' || status === 'Rejected' || status === 'Approved') {
        acc[merchant][status] = (acc[merchant][status] || 0) + 1
      }
      return acc
    }, {} as Record<string, { Pending: number; Rejected: number; Approved: number }>)
    
    return stats
  }, [data?.data])
  
  const handleNetworkToggle = (networkId: string) => {
    setSelectedNetworkIds(prev => {
      if (prev.includes(networkId)) {
        return prev.filter(id => id !== networkId)
      } else {
        return [...prev, networkId]
      }
    })
  }
  
  const handleSelectAll = () => {
    setSelectedNetworkIds([]) // 空数组表示选择所有
  }
  
  const handleAccountToggle = (accountId: string) => {
    setSelectedAccountIds(prev => {
      if (prev.includes(accountId)) {
        return prev.filter(id => id !== accountId)
      } else {
        return [...prev, accountId]
      }
    })
  }
  
  const handleSelectAllAccounts = () => {
    setSelectedAccountIds([]) // 空数组表示选择所有
  }
  
  const isAllSelected = selectedNetworkIds.length === 0
  const isAllAccountsSelected = selectedAccountIds.length === 0
  
  const toggleNetwork = (networkId: string) => {
    setExpandedNetworks(prev => {
      const next = new Set(prev)
      if (next.has(networkId)) {
        next.delete(networkId)
      } else {
        next.add(networkId)
      }
      return next
    })
  }
  
  const toggleAccount = (networkId: string, accountId: string) => {
    setExpandedAccounts(prev => {
      const next = new Map(prev)
      const accounts = next.get(networkId) || new Set<string>()
      const newAccounts = new Set(accounts)
      if (newAccounts.has(accountId)) {
        newAccounts.delete(accountId)
      } else {
        newAccounts.add(accountId)
      }
      next.set(networkId, newAccounts)
      return next
    })
  }
  
  return (
    <div className={styles.container}>
      {/* 查询表单 */}
      <div className={styles.form}>
        <h2 className={styles.formTitle}>业绩查询</h2>
        
        {/* 联盟选择和账号选择并排 */}
        <div className={styles.field}>
          <label className={styles.label}>选择联盟</label>
          <div className={styles.networkOptions}>
            <button
              type="button"
              onClick={handleSelectAll}
              className={`${styles.selectAllBtn} ${isAllSelected ? styles.active : ''}`}
            >
              全部联盟
            </button>
            {loadingNetworks ? (
              <span className={styles.note}>加载中...</span>
            ) : networks.length === 0 ? (
              <span className={styles.note}>未找到联盟配置</span>
            ) : (
              networks.map((network) => (
                <button
                  key={network.id}
                  type="button"
                  onClick={() => handleNetworkToggle(network.id)}
                  className={`${styles.networkBtn} ${
                    selectedNetworkIds.includes(network.id) ? styles.active : ''
                  }`}
                >
                  {network.name}
                </button>
              ))
            )}
          </div>
        </div>
        
        <div className={styles.field}>
          <label className={styles.label}>选择账号 (可选)</label>
          <div className={styles.networkOptions}>
            <button
              type="button"
              onClick={handleSelectAllAccounts}
              className={`${styles.selectAllBtn} ${isAllAccountsSelected ? styles.active : ''}`}
            >
              全部账号
            </button>
            {loadingNetworks ? (
              <span className={styles.note}>加载中...</span>
            ) : accounts.length === 0 ? (
              <span className={styles.note}>未找到账号配置</span>
            ) : (
              accounts.map((account) => (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => handleAccountToggle(account.id)}
                  className={`${styles.networkBtn} ${
                    selectedAccountIds.includes(account.id) ? styles.active : ''
                  }`}
                >
                  {account.accountName}
                </button>
              ))
            )}
          </div>
        </div>
        
        {/* 日期范围 */}
        <div className={`${styles.field} ${styles.fieldFull}`}>
          <div className={styles.dateRangeRow}>
            {/* 快速选择按钮 */}
            <div className={styles.datePresets}>
            <button
              type="button"
              onClick={() => setDatePreset('today')}
              className={`${styles.datePresetBtn} ${activeDatePreset === 'today' ? styles.active : ''}`}
            >
              今天
            </button>
            <button
              type="button"
              onClick={() => setDatePreset('yesterday')}
              className={`${styles.datePresetBtn} ${activeDatePreset === 'yesterday' ? styles.active : ''}`}
            >
              昨天
            </button>
            <button
              type="button"
              onClick={() => setDatePreset('last7days')}
              className={`${styles.datePresetBtn} ${activeDatePreset === 'last7days' ? styles.active : ''}`}
            >
              近7天
            </button>
            <button
              type="button"
              onClick={() => setDatePreset('last30days')}
              className={`${styles.datePresetBtn} ${activeDatePreset === 'last30days' ? styles.active : ''}`}
            >
              近30天
            </button>
            <button
              type="button"
              onClick={() => setDatePreset('thisMonth')}
              className={`${styles.datePresetBtn} ${activeDatePreset === 'thisMonth' ? styles.active : ''}`}
            >
              本月
            </button>
            <button
              type="button"
              onClick={() => setDatePreset('lastMonth')}
              className={`${styles.datePresetBtn} ${activeDatePreset === 'lastMonth' ? styles.active : ''}`}
            >
              上月
            </button>
            <button
              type="button"
              onClick={() => setDatePreset('last180days')}
              className={`${styles.datePresetBtn} ${activeDatePreset === 'last180days' ? styles.active : ''}`}
            >
              近180天
            </button>
            <button
              type="button"
              onClick={() => setDatePreset('lastYear')}
              className={`${styles.datePresetBtn} ${activeDatePreset === 'lastYear' ? styles.active : ''}`}
            >
              近一年
            </button>
            </div>
            
            {/* 自定义日期选择 */}
            <div className={styles.dateRange}>
              <input
                type="date"
                value={beginDate}
                onChange={e => {
                  setBeginDate(e.target.value)
                  setActiveDatePreset('')
                }}
                className={styles.dateInput}
              />
              <span className={styles.dateSeparator}>至</span>
              <input
                type="date"
                value={endDate}
                onChange={e => {
                  setEndDate(e.target.value)
                  setActiveDatePreset('')
                }}
                className={styles.dateInput}
              />
            </div>
          </div>
        </div>
        
        {/* 查询按钮、查看图表按钮和联盟业绩卡片并排 */}
        <div className={styles.queryBtnWrapper}>
          <button
            onClick={handleQuery}
            disabled={loading}
            className={styles.queryBtn}
          >
            {loading ? '查询中...' : '查询业绩'}
          </button>
          
          {/* 查看图表按钮 */}
          {data && (
            <CommissionChartToggle 
              isVisible={isChartsVisible}
              onToggle={() => setIsChartsVisible(!isChartsVisible)}
            />
          )}
          
          {/* 联盟明细 - 移到按钮旁边 */}
          {data && Object.keys(data.summary.networks).length > 0 && (
            <div className={styles.networkSummaryInline}>
              <div className={styles.networkGrid}>
                {Object.entries(data.summary.networks).map(([networkId, stats]) => (
                  <div key={networkId}>
                    <div className={styles.networkCard}>
                      <div 
                        className={styles.networkHeader}
                        onClick={() => toggleNetwork(networkId)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className={styles.networkId}>
                          {stats.networkName || networkId}
                        </div>
                        <span className={styles.toggleIcon}>
                          {expandedNetworks.has(networkId) ? '▼' : '▶'}
                        </span>
                      </div>
                      <div className={styles.networkStatsInline}>
                        <span>销售额: ${(stats.amount || 0).toFixed(2)}</span>
                        <span>佣金: ${(stats.commission || 0).toFixed(2)}</span>
                      </div>
                    </div>
                    {/* 账号明细 - 独立的向下滑出卡片 */}
                    {expandedNetworks.has(networkId) && Object.keys(stats.accounts || {}).length > 0 && (
                      <div className={styles.accountDetailsContainer}>
                        <div className={styles.accountDetails}>
                          {Object.entries(stats.accounts).map(([accountId, accountStats]) => (
                            <div key={accountId} className={styles.accountItem}>
                              <span className={styles.accountName}>
                                {accountStats.accountName || accountId}
                              </span>
                              <span className={styles.accountAmount}>
                                销售额: ${(accountStats.amount || 0).toFixed(2)}, 佣金: ${(accountStats.commission || 0).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* 错误提示 */}
        {error && <div className={styles.error}>{error}</div>}
        {successMessage && <div className={styles.success}>{successMessage}</div>}
        {warningMessage && <div className={styles.warning}>{warningMessage}</div>}
      </div>
      
      {/* 结果展示 */}
      {data && (
        <div className={styles.results}>
          {/* 可视化报告 */}
          <CommissionReport data={data.data} isChartsVisible={isChartsVisible} />
          
          {/* 数据列表 */}
          <div className={styles.dataList}>
            <div className={styles.dataListHeader}>
              <div className={styles.dataListTitleSection}>
                <h3 className={styles.dataListTitle}>业绩明细</h3>
                <div className={styles.statsBadges}>
                  <div className={styles.statBadge}>
                    <span className={styles.statLabel}>销售额：</span>
                    <span className={styles.statValue}>${(filteredStats.totalAmount || 0).toFixed(2)}</span>
                  </div>
                  <div className={styles.commissionBadge}>
                    <button
                      onClick={() => setIsCommissionExpanded(!isCommissionExpanded)}
                      className={styles.commissionBadgeBtn}
                    >
                    <span className={styles.statLabel}>佣金：</span>
                    <span className={styles.statValue}>${(filteredStats.totalCommission || 0).toFixed(2)}</span>
                      <span className={styles.expandIcon}>{isCommissionExpanded ? '▼' : '▶'}</span>
                    </button>
                    {isCommissionExpanded && (
                      <div className={styles.commissionSubList}>
                        <div className={styles.commissionSubItem}>
                          <span className={styles.commissionSubLabel}>Pending佣金：</span>
                          <span className={styles.commissionSubValue}>${((filteredStats.statusCommissions?.Pending || 0)).toFixed(2)}</span>
                        </div>
                        <div className={styles.commissionSubItem}>
                          <span className={styles.commissionSubLabel}>Rejected佣金：</span>
                          <span className={styles.commissionSubValue}>${((filteredStats.statusCommissions?.Rejected || 0)).toFixed(2)}</span>
                        </div>
                        <div className={styles.commissionSubItem}>
                          <span className={styles.commissionSubLabel}>Approved佣金：</span>
                          <span className={styles.commissionSubValue}>${((filteredStats.statusCommissions?.Approved || 0)).toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                  {['Pending', 'Rejected', 'Approved'].map((status) => (
                    <div key={status} className={styles.statBadge}>
                      <span className={styles.statLabel}>{status}：</span>
                      <span className={styles.statValue}>{filteredStats.statusCounts[status] || 0}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className={styles.pageSizeSelector}>
                <label>每页显示：</label>
                <select 
                  value={pageSize} 
                  onChange={e => {
                    setPageSize(Number(e.target.value))
                    setCurrentPage(1)
                  }}
                  className={styles.pageSizeSelect}
                >
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                </select>
              </div>
            </div>
            {/* 商家汇总表格：只在筛选状态（非"全部"）时显示 */}
            {filterStatus !== '全部' && filteredMerchantInfo.length > 0 && (
              <div className={styles.merchantSummarySection}>
                <button
                  onClick={() => setIsMerchantSummaryExpanded(!isMerchantSummaryExpanded)}
                  className={styles.merchantSummaryHeaderBtn}
                >
                  <span className={styles.expandIcon}>{isMerchantSummaryExpanded ? '▼' : '▶'}</span>
                  <h4 className={styles.merchantSummaryTitle}>
                    筛选结果商家汇总 ({filteredMerchantInfo.length} 个)
                  </h4>
                </button>
                {isMerchantSummaryExpanded && (
                  <div className={styles.merchantSummaryList}>
                    {filteredMerchantInfo.map((merchant, index) => {
                      const allStats = merchantStatusStats[merchant.merchantName] || { Pending: 0, Rejected: 0, Approved: 0 }
                      return (
                        <div
                          key={merchant.mcid || index}
                          className={styles.merchantSummaryItem}
                          title={`品牌ID: ${merchant.brandId}`}
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect()
                            setHoveredMerchant(merchant.merchantName)
                            setTooltipPosition({
                              top: rect.bottom + 8,
                              left: rect.left
                            })
                          }}
                          onMouseLeave={() => {
                            setHoveredMerchant(null)
                            setTooltipPosition(null)
                          }}
                        >
                          <span className={styles.mcidText}>{merchant.mcid}</span>
                          <span className={styles.brandIdText}>{merchant.brandId}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
            
            <div className={styles.table}>
              {/* 表头始终显示，这样用户即使在没有数据时也能调整筛选条件 */}
                  <div className={styles.tableHeader}>
                    <div className={styles.tableCell}>
                      <div className={styles.tableHeaderCell}>
                        <span>商家名称</span>
                        <input
                          type="text"
                          placeholder="筛选..."
                          value={filterMerchantName}
                          onChange={e => setFilterMerchantName(e.target.value)}
                          className={styles.tableFilterInput}
                        />
                      </div>
                    </div>
                    <div className={styles.tableCell}>
                      <div className={styles.tableHeaderCell}>
                        <span>品牌ID</span>
                        <input
                          type="text"
                          placeholder="筛选..."
                          value={filterBrandId}
                          onChange={e => setFilterBrandId(e.target.value)}
                          className={styles.tableFilterInput}
                        />
                      </div>
                    </div>
                    <div className={styles.tableCell}>
                      <div className={styles.tableHeaderCell}>
                        <span>MCID</span>
                        <input
                          type="text"
                          placeholder="筛选..."
                          value={filterMcid}
                          onChange={e => setFilterMcid(e.target.value)}
                          className={styles.tableFilterInput}
                        />
                      </div>
                    </div>
                    <div className={styles.tableCell}>销售额</div>
                    <div className={styles.tableCell}>佣金</div>
                    <div className={styles.tableCell}>
                      <div className={styles.tableHeaderCell}>
                        <span>状态</span>
                        <select
                          value={filterStatus}
                          onChange={e => setFilterStatus(e.target.value)}
                          className={styles.tableFilterSelect}
                        >
                          <option value="全部">全部</option>
                          <option value="Pending">Pending</option>
                          <option value="Approved">Approved</option>
                          <option value="Rejected">Rejected</option>
                        </select>
                      </div>
                    </div>
                    <div className={styles.tableCell}>
                      <div className={styles.tableHeaderCell}>
                        <span>支付状态</span>
                        <select
                          value={filterPaidStatus}
                          onChange={e => setFilterPaidStatus(e.target.value)}
                          className={styles.tableFilterSelect}
                        >
                          <option value="全部">全部</option>
                          <option value="未支付">未支付</option>
                          <option value="已支付">已支付</option>
                        </select>
                      </div>
                    </div>
                  <div className={styles.tableCell}>
                    <div className={styles.tableHeaderCell}>
                      <span>时间</span>
                      <div className={styles.sortControls}>
                        <button
                          type="button"
                          onClick={() => {
                            // 如果当前是升序，点击后取消排序；否则设置为升序
                            setTimeSortOrder(timeSortOrder === 'asc' ? null : 'asc')
                          }}
                          className={`${styles.sortBtn} ${timeSortOrder === 'asc' ? styles.sortActive : ''}`}
                          title="升序排序"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            // 如果当前是降序，点击后取消排序；否则设置为降序
                            setTimeSortOrder(timeSortOrder === 'desc' ? null : 'desc')
                          }}
                          className={`${styles.sortBtn} ${timeSortOrder === 'desc' ? styles.sortActive : ''}`}
                          title="降序排序"
                        >
                          ↓
                        </button>
                      </div>
                    </div>
                    </div>
                  </div>
              {/* 数据行：有数据时显示数据，没有数据时显示"暂无数据" */}
              {filteredAndPaginatedData.list.length === 0 ? (
                <div className={styles.emptyState}>暂无数据</div>
              ) : (
                filteredAndPaginatedData.list.map((item) => (
                    <div key={item.id} className={styles.tableRow}>
                    <div 
                      className={styles.tableCell}
                      onMouseEnter={(e) => {
                        const merchantName = item.merchantName || null
                        if (merchantName && merchantStatusStats[merchantName]) {
                          const rect = e.currentTarget.getBoundingClientRect()
                          setHoveredMerchant(merchantName)
                          setTooltipPosition({
                            top: rect.bottom + 8,
                            left: rect.left
                          })
                        }
                      }}
                      onMouseLeave={() => {
                        setHoveredMerchant(null)
                        setTooltipPosition(null)
                      }}
                    >
                      <span className={styles.merchantName}>{item.merchantName || '-'}</span>
                    </div>
                      <div className={styles.tableCell}>{item.brandId || '-'}</div>
                      <div className={styles.tableCell}>{item.mcid || '-'}</div>
                      <div className={styles.tableCell}>${(item.saleAmount || 0).toFixed(2)}</div>
                      <div className={styles.tableCell}>${(item.commission || 0).toFixed(2)}</div>
                      <div className={styles.tableCell}>
                        <span className={`${styles.status} ${styles[`status-${item.status.toLowerCase()}`]}`}>
                          {item.status}
                        </span>
                      </div>
                      <div className={styles.tableCell}>
                        <span className={`${styles.paidStatus} ${item.paidStatus === 1 ? styles.paidStatusPaid : styles.paidStatusUnpaid}`}>
                          {item.paidStatus === 1 ? '已支付' : item.paidStatus === 0 ? '未支付' : '-'}
                        </span>
                      </div>
                      <div className={styles.tableCell}>
                        {item.orderTime && item.orderTime > 0 
                          ? new Date(item.orderTime * 1000).toLocaleString('zh-CN')
                          : 'N/A'}
                      </div>
                    </div>
                ))
              )}
                </div>
                
            {/* 分页信息：只在有数据时显示 */}
                {filteredAndPaginatedData.totalPages > 1 && (
                  <div className={styles.pagination}>
                    <div className={styles.paginationLeft}>
                      <span className={styles.pageInfo}>
                        第 {currentPage} / {filteredAndPaginatedData.totalPages} 页，共 {filteredAndPaginatedData.total} 条
                      </span>
                    </div>
                    
                    <div className={styles.paginationCenter}>
                      {/* 首页按钮 */}
                      <button
                        onClick={() => {
                          setCurrentPage(1)
                          setPageInputValue('')
                        }}
                        disabled={currentPage === 1}
                        className={styles.pageBtn}
                        title="首页"
                      >
                        首页
                      </button>
                      
                      {/* 上一页按钮 */}
                      <button
                        onClick={() => {
                          const newPage = Math.max(1, currentPage - 1)
                          setCurrentPage(newPage)
                          setPageInputValue('')
                        }}
                        disabled={currentPage === 1}
                        className={styles.pageBtn}
                      >
                        上一页
                      </button>
                      
                      {/* 页码按钮 */}
                      {(() => {
                        const totalPages = filteredAndPaginatedData.totalPages
                        const pages: (number | string)[] = []
                        const showPages = 5 // 显示当前页附近的5页
                        
                        if (totalPages <= showPages + 2) {
                          // 总页数较少，显示所有页码
                          for (let i = 1; i <= totalPages; i++) {
                            pages.push(i)
                          }
                        } else {
                          // 总页数较多，显示部分页码
                          if (currentPage <= 3) {
                            // 当前页在前面
                            for (let i = 1; i <= showPages; i++) {
                              pages.push(i)
                            }
                            pages.push('...')
                            pages.push(totalPages)
                          } else if (currentPage >= totalPages - 2) {
                            // 当前页在后面
                            pages.push(1)
                            pages.push('...')
                            for (let i = totalPages - showPages + 1; i <= totalPages; i++) {
                              pages.push(i)
                            }
                          } else {
                            // 当前页在中间
                            pages.push(1)
                            pages.push('...')
                            const start = Math.max(2, currentPage - Math.floor(showPages / 2))
                            const end = Math.min(totalPages - 1, start + showPages - 1)
                            for (let i = start; i <= end; i++) {
                              pages.push(i)
                            }
                            pages.push('...')
                            pages.push(totalPages)
                          }
                        }
                        
                        return pages.map((page, index) => {
                          if (page === '...') {
                            return (
                              <span key={`ellipsis-${index}`} className={styles.pageEllipsis}>
                                ...
                              </span>
                            )
                          }
                          const pageNum = page as number
                          return (
                            <button
                              key={pageNum}
                              onClick={() => {
                                setCurrentPage(pageNum)
                                setPageInputValue('')
                              }}
                              className={`${styles.pageNumberBtn} ${currentPage === pageNum ? styles.pageNumberBtnActive : ''}`}
                            >
                              {pageNum}
                            </button>
                          )
                        })
                      })()}
                      
                      {/* 下一页按钮 */}
                      <button
                        onClick={() => {
                          const newPage = Math.min(filteredAndPaginatedData.totalPages, currentPage + 1)
                          setCurrentPage(newPage)
                          setPageInputValue('')
                        }}
                        disabled={currentPage === filteredAndPaginatedData.totalPages}
                        className={styles.pageBtn}
                      >
                        下一页
                      </button>
                      
                      {/* 末页按钮 */}
                      <button
                        onClick={() => {
                          setCurrentPage(filteredAndPaginatedData.totalPages)
                          setPageInputValue('')
                        }}
                        disabled={currentPage === filteredAndPaginatedData.totalPages}
                        className={styles.pageBtn}
                        title="末页"
                      >
                        末页
                      </button>
                    </div>
                    
                    {/* 跳转输入框 */}
                    <div className={styles.pageJump}>
                      <span>跳转到</span>
                      <input
                        type="number"
                        min="1"
                        max={filteredAndPaginatedData.totalPages}
                        value={pageInputValue}
                        onChange={(e) => {
                          const value = e.target.value
                          setPageInputValue(value)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const pageNum = parseInt(pageInputValue, 10)
                            if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= filteredAndPaginatedData.totalPages) {
                              setCurrentPage(pageNum)
                              setPageInputValue('')
                            }
                          }
                        }}
                        placeholder={`1-${filteredAndPaginatedData.totalPages}`}
                        className={styles.pageInput}
                      />
                      <span>页</span>
                      <button
                        onClick={() => {
                          const pageNum = parseInt(pageInputValue, 10)
                          if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= filteredAndPaginatedData.totalPages) {
                            setCurrentPage(pageNum)
                            setPageInputValue('')
                          }
                        }}
                        disabled={!pageInputValue || isNaN(parseInt(pageInputValue, 10)) || parseInt(pageInputValue, 10) < 1 || parseInt(pageInputValue, 10) > filteredAndPaginatedData.totalPages}
                        className={styles.pageJumpBtn}
                      >
                        跳转
                      </button>
                    </div>
                  </div>
            )}
          </div>
        </div>
      )}
      
      {/* 调试面板 */}
      <DebugPanel data={data} loading={loading} error={error} />
      
      {/* 商家状态Tooltip（使用Portal渲染到body） */}
      {hoveredMerchant && tooltipPosition && merchantStatusStats[hoveredMerchant] && typeof window !== 'undefined' && createPortal(
        <div 
          ref={tooltipRef}
          className={styles.merchantTooltip}
          style={{
            position: 'fixed',
            top: `${tooltipPosition.top}px`,
            left: `${tooltipPosition.left}px`,
          }}
          onMouseEnter={() => {}} // 保持tooltip显示
          onMouseLeave={() => {
            setHoveredMerchant(null)
            setTooltipPosition(null)
          }}
        >
          <div className={styles.tooltipTitle}>{hoveredMerchant}</div>
          <div className={styles.tooltipStats}>
            <div className={styles.tooltipStatItem}>
              <span className={styles.tooltipStatLabel}>Pending：</span>
              <span className={styles.tooltipStatValue}>{merchantStatusStats[hoveredMerchant].Pending || 0}笔</span>
            </div>
            <div className={styles.tooltipStatItem}>
              <span className={styles.tooltipStatLabel}>Rejected：</span>
              <span className={styles.tooltipStatValue}>{merchantStatusStats[hoveredMerchant].Rejected || 0}笔</span>
            </div>
            <div className={styles.tooltipStatItem}>
              <span className={styles.tooltipStatLabel}>Approved：</span>
              <span className={styles.tooltipStatValue}>{merchantStatusStats[hoveredMerchant].Approved || 0}笔</span>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

