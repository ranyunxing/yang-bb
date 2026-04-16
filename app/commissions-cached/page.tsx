'use client'

import { useState, useEffect, useMemo, Fragment, type MouseEvent as ReactMouseEvent, type ChangeEvent, useRef } from 'react'
import { createPortal } from 'react-dom'
import dynamic from 'next/dynamic'
import { CommissionSummary, NetworkConfig, NetworkAccount, UnifiedCommission } from '@/types'
import CommissionChartToggle from '@/components/CommissionChartToggle'
import DebugPanel from '@/components/DebugPanel'
import { computeOfferDayTotals, offerCompositeKey } from '@/lib/commissions/offerDayTotals'
import styles from './page.module.css'

const CommissionReport = dynamic(() => import('@/components/CommissionReport'), { ssr: false })

export default function CommissionsCachedPage() {
  const [networks, setNetworks] = useState<NetworkConfig[]>([])
  const [accounts, setAccounts] = useState<NetworkAccount[]>([])
  const [selectedNetworkIds, setSelectedNetworkIds] = useState<string[]>([])
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([])
  const [beginDate, setBeginDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [loadingNetworks, setLoadingNetworks] = useState(false)
  const [data, setData] = useState<CommissionSummary | null>(null)
  const [allRows, setAllRows] = useState<UnifiedCommission[]>([])
  const [serverRowsCache, setServerRowsCache] = useState<UnifiedCommission[]>([])
  const [serverCacheRange, setServerCacheRange] = useState<{ beginDate: string; endDate: string } | null>(null)
  const [serverCacheScope, setServerCacheScope] = useState<{ networkIds: string[]; accountIds: string[] } | null>(null)
  const [error, setError] = useState('')
  const [activeDatePreset, setActiveDatePreset] = useState<string>('')
  
  // 筛选状态
  const [filterMerchantName, setFilterMerchantName] = useState('')
  const [filterMcid, setFilterMcid] = useState('')
  const [filterBrandId, setFilterBrandId] = useState('')
  const [debouncedMerchantName, setDebouncedMerchantName] = useState('')
  const [debouncedMcid, setDebouncedMcid] = useState('')
  const [debouncedBrandId, setDebouncedBrandId] = useState('')
  const [filterStatus, setFilterStatus] = useState('全部')
  const [filterNetworkId, setFilterNetworkId] = useState('全部')
  const [filterAccountId, setFilterAccountId] = useState('全部')
  const [timeSortOrder, setTimeSortOrder] = useState<'asc' | 'desc' | null>(null)
  const [isCommissionExpanded, setIsCommissionExpanded] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [pageInputValue, setPageInputValue] = useState('')
  
  const [successMessage, setSuccessMessage] = useState('')
  const [warningMessage, setWarningMessage] = useState('')
  const [syncMessage, setSyncMessage] = useState('')
  const [isChartsVisible, setIsChartsVisible] = useState(false)
  const [isAdvancedVisible, setIsAdvancedVisible] = useState(true)
  const [isMerchantSummaryCollapsed, setIsMerchantSummaryCollapsed] = useState(false)
  const [merchantAgg, setMerchantAgg] = useState<any>(null)
  const [hoveredMerchantKey, setHoveredMerchantKey] = useState<string | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number } | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const tooltipHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const queryAbortRef = useRef<AbortController | null>(null)
  const [portalReady, setPortalReady] = useState(false)

  const cancelTooltipHide = () => {
    if (tooltipHideTimerRef.current) {
      clearTimeout(tooltipHideTimerRef.current)
      tooltipHideTimerRef.current = null
    }
  }

  const scheduleTooltipHide = () => {
    cancelTooltipHide()
    tooltipHideTimerRef.current = setTimeout(() => {
      setHoveredMerchantKey(null)
      setTooltipPosition(null)
    }, 150)
  }

  useEffect(() => {
    setPortalReady(true)
    return () => {
      if (tooltipHideTimerRef.current) {
        clearTimeout(tooltipHideTimerRef.current)
        tooltipHideTimerRef.current = null
      }
      if (queryAbortRef.current) {
        queryAbortRef.current.abort()
        queryAbortRef.current = null
      }
    }
  }, [])
  /** 日汇总展开：锚定行 id + offer 维度 */
  const [offerInsight, setOfferInsight] = useState<{
    rowId: string
    mcid: string
    brandId: string
  } | null>(null)

  // 查询缓存（保留兼容，不再用于本地筛选）
  const [pageCache, setPageCache] = useState<Record<string, CommissionSummary>>({})
  const [countCache, setCountCache] = useState<Record<string, { total: number; totalPage: number }>>({})

  const buildQueryKey = (opts: {
    page: number
    perPage: number
  }) => {
    const normalized = {
      networkIds: [...selectedNetworkIds].sort(),
      accountIds: [...selectedAccountIds].sort(),
      beginDate,
      endDate,
      merchantName: filterMerchantName.trim() || undefined,
      mcid: filterMcid.trim() || undefined,
      brandId: filterBrandId.trim() || undefined,
      status: filterStatus !== '全部' ? filterStatus : undefined,
      sortOrder: timeSortOrder || 'desc',
      // paidStatus 已移除
      perPage: opts.perPage,
      curPage: opts.page,
    }
    return JSON.stringify(normalized)
  }

  const buildCountKey = (perPage: number) => {
    const normalized = {
      networkIds: [...selectedNetworkIds].sort(),
      accountIds: [...selectedAccountIds].sort(),
      beginDate,
      endDate,
      merchantName: filterMerchantName.trim() || undefined,
      mcid: filterMcid.trim() || undefined,
      brandId: filterBrandId.trim() || undefined,
      status: filterStatus !== '全部' ? filterStatus : undefined,
      sortOrder: timeSortOrder || 'desc',
      perPage,
    }
    return JSON.stringify(normalized)
  }

  const toDayStartTs = (dateStr: string) => new Date(`${dateStr}T00:00:00`).getTime()
  const toDayEndTs = (dateStr: string) => new Date(`${dateStr}T23:59:59.999`).getTime()
  const normalizeIds = (ids: string[]) => [...ids].sort()
  const isSameIds = (a: string[], b: string[]) =>
    a.length === b.length && a.every((v, i) => v === b[i])

  // 兜底排序：不同联盟/账号数据混在一起时，也能按时间统一倒序展示
  function sortByOrderTimeDesc(rows: UnifiedCommission[]) {
    return [...rows].sort((a, b) => (Number(b.orderTime) || 0) - (Number(a.orderTime) || 0))
  }

  // 加载联盟列表和账号列表
  useEffect(() => {
    const loadData = async () => {
      setLoadingNetworks(true)
      try {
        const networksResponse = await fetch('/api/networks')
        if (!networksResponse.ok) throw new Error('获取联盟列表失败')
        const networksData = await networksResponse.json()
        setNetworks(networksData)
        
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

  // 日期快速选择
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
        startDate.setDate(today.getDate() - 6)
        break
      case 'last30days':
        startDate = new Date(today)
        startDate.setDate(today.getDate() - 29)
        break
      case 'last180days':
        startDate = new Date(today)
        startDate.setDate(today.getDate() - 179)
        break
      case 'lastYear':
        startDate = new Date(today)
        startDate.setDate(today.getDate() - 364)
        break
      case 'thisMonth':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1)
        endDate = new Date(today)
        break
      case 'lastMonth':
        startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        endDate = new Date(today.getFullYear(), today.getMonth(), 0)
        break
      default:
        return
    }
    
    const formatDate = (date: Date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
    
    const nextBeginDate = formatDate(startDate)
    const nextEndDate = formatDate(endDate)
    setBeginDate(nextBeginDate)
    setEndDate(nextEndDate)
    setActiveDatePreset(preset)
    // 点击预设按钮时立即应用时间范围，无需再次点击“查询数据”
    handleQuery(1, { beginDate: nextBeginDate, endDate: nextEndDate })
  }

  // 手动同步数据
  const handleSync = async () => {
    setSyncing(true)
    setError('')
    setSyncMessage('')
    setSuccessMessage('')
    setWarningMessage('')

    try {
      const response = await fetch('/api/commissions/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          networkIds: selectedNetworkIds.length > 0 ? selectedNetworkIds : undefined,
          accountIds: selectedAccountIds.length > 0 ? selectedAccountIds : undefined,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '同步失败')
      }

      const result = await response.json()
      const apiErrors: string[] = result.apiErrors || []
      const apiWarnings: string[] = result.apiWarnings || []
      const dbErrors: string[] = result.errors || []

      if (result.success) {
        setSyncMessage(result.message || `同步成功：插入了 ${result.inserted} 条数据`)
        if (apiWarnings.length > 0) {
          setWarningMessage(`同步警告：${apiWarnings.length} 条（不影响写库，但可能存在缺失风险）`)
        }
        setSuccessMessage('数据同步成功，现在可以查询了')
        // 同步后清空缓存，确保查询看到最新数据
        setPageCache({})
        setCountCache({})
        setMerchantAgg(null)
        setAllRows([])
        setServerRowsCache([])
        setServerCacheRange(null)
        setServerCacheScope(null)
        // 同步成功后自动查询一次（回到第一页）
        setTimeout(() => {
          handleQuery(1)
        }, 500)
      } else {
        // 部分成功/失败：必须明确告诉用户“数据可能不完整”
        setWarningMessage('本次同步存在错误：数据库中的数据可能不完整，请查看错误详情后重试。')
        setSyncMessage(result.message || `部分成功：已插入 ${result.inserted || 0} 条数据`)
        // 同步结果不完整也清空缓存，避免展示旧 total/旧页数据
        setPageCache({})
        setCountCache({})
        setMerchantAgg(null)
        setAllRows([])
        setServerRowsCache([])
        setServerCacheRange(null)
        setServerCacheScope(null)

        const details = [
          ...(apiErrors.length > 0 ? [`API 错误（${apiErrors.length}）：${apiErrors.slice(0, 3).join('；')}${apiErrors.length > 3 ? '…' : ''}`] : []),
          ...(dbErrors.length > 0 ? [`写库错误（${dbErrors.length}）：${dbErrors.slice(0, 3).join('；')}${dbErrors.length > 3 ? '…' : ''}`] : []),
        ]
        if (details.length > 0) setError(details.join('\n'))

        // 仍然允许查询已写入的数据（回到第一页）
        setTimeout(() => {
          handleQuery(1)
        }, 500)
      }
    } catch (err: any) {
      console.error('同步失败:', err)
      setError(err.message || '同步失败')
    } finally {
      setSyncing(false)
    }
  }

  // 查询数据（从数据库拉取当前范围全量数据，后续前端秒筛选）
  const handleQuery = async (
    arg: number | ReactMouseEvent<HTMLButtonElement> | undefined = undefined,
    dateOverride?: { beginDate: string; endDate: string }
  ) => {
    const targetPage = typeof arg === 'number' ? arg : currentPage
    const queryBeginDate = dateOverride?.beginDate ?? beginDate
    const queryEndDate = dateOverride?.endDate ?? endDate

    if (!queryBeginDate || !queryEndDate) {
      setError('请选择日期范围')
      return
    }

    setLoading(true)
    setError('')
    setSuccessMessage('')
    setWarningMessage('')
    if (queryAbortRef.current) queryAbortRef.current.abort()
    const controller = new AbortController()
    queryAbortRef.current = controller

    try {
      const targetBeginTs = toDayStartTs(queryBeginDate)
      const targetEndTs = toDayEndTs(queryEndDate)
      const scopeNetworkIds = normalizeIds(selectedNetworkIds)
      const scopeAccountIds = normalizeIds(selectedAccountIds)

      const canReuseServerCache =
        serverCacheRange &&
        serverCacheScope &&
        isSameIds(serverCacheScope.networkIds, scopeNetworkIds) &&
        isSameIds(serverCacheScope.accountIds, scopeAccountIds) &&
        targetBeginTs >= toDayStartTs(serverCacheRange.beginDate) &&
        targetEndTs <= toDayEndTs(serverCacheRange.endDate)

      if (canReuseServerCache) {
        const all = serverRowsCache.filter((r) => {
          const t = Number(r.orderTime) || 0
          return t >= targetBeginTs && t <= targetEndTs
        })
        const baseTotal = all.length
        const safePage = 1
        const paged = all.slice(0, pageSize)
        setCurrentPage(safePage)
        setAllRows(all)
        setData((prev) => ({
          ...(prev || ({} as CommissionSummary)),
          data: paged,
          total: baseTotal,
          totalPage: Math.max(1, Math.ceil(baseTotal / pageSize)),
          curPage: safePage,
        }))
        setMerchantAgg(null)
        setSuccessMessage(`查询成功（本地秒筛），共 ${baseTotal} 条数据`)
        return
      }

      const perPageForFetch = 2000
      let cur = 1
      let totalPage = 1
      let all: UnifiedCommission[] = []
      let firstResult: CommissionSummary | null = null

      while (cur <= totalPage) {
        const response = await fetch('/api/commissions/cached', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            networkIds: selectedNetworkIds.length > 0 ? selectedNetworkIds : undefined,
            accountIds: selectedAccountIds.length > 0 ? selectedAccountIds : undefined,
            beginDate: queryBeginDate,
            endDate: queryEndDate,
            curPage: cur,
            perPage: perPageForFetch,
            sortOrder: timeSortOrder || 'desc',
            skipCount: cur > 1 ? true : undefined,
            knownTotal: firstResult?.total,
            skipSummary: cur > 1 ? true : undefined,
            skipMerchantAgg: cur > 1 ? true : undefined,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || '查询失败')
        }

        const result = (await response.json()) as CommissionSummary
        if (cur === 1) {
          firstResult = result
          totalPage = result.totalPage || 1
        }
        all = all.concat(Array.isArray(result.data) ? result.data : [])
        cur += 1
      }

      const baseTotal = all.length
      const paged = all.slice((targetPage - 1) * pageSize, (targetPage - 1) * pageSize + pageSize)
      const base: CommissionSummary = {
        ...(firstResult || ({} as CommissionSummary)),
        data: paged,
        total: baseTotal,
        totalPage: Math.max(1, Math.ceil(baseTotal / pageSize)),
        curPage: targetPage,
      }

      setAllRows(all)
      setServerRowsCache(all)
      setServerCacheRange({ beginDate: queryBeginDate, endDate: queryEndDate })
      setServerCacheScope({ networkIds: scopeNetworkIds, accountIds: scopeAccountIds })
      setData(base)
      setMerchantAgg((firstResult as any)?.merchantAgg || null)
      setSuccessMessage(`查询成功，共 ${baseTotal} 条数据`)
    } catch (err: any) {
      if (err?.name === 'AbortError') return
      console.error('查询失败:', err)
      setError(err.message || '查询失败')
      setData(null)
      setAllRows([])
    } finally {
      if (queryAbortRef.current === controller) {
        queryAbortRef.current = null
      }
      setLoading(false)
    }
  }

  // 前端筛选条件变化：本地秒筛选，不再请求后端
  useEffect(() => {
    if (!data || allRows.length === 0) return
    let rows = [...allRows]
    if (filterNetworkId !== '全部') rows = rows.filter((r: any) => String((r as any).networkId) === filterNetworkId)
    if (filterAccountId !== '全部') rows = rows.filter((r: any) => String((r as any).accountId) === filterAccountId)
    if (debouncedMerchantName.trim()) rows = rows.filter((r) => String(r.merchantName || '').toLowerCase().includes(debouncedMerchantName.trim().toLowerCase()))
    if (debouncedBrandId.trim()) rows = rows.filter((r) => String(r.brandId || '').toLowerCase().includes(debouncedBrandId.trim().toLowerCase()))
    if (debouncedMcid.trim()) rows = rows.filter((r) => String(r.mcid || '').toLowerCase().includes(debouncedMcid.trim().toLowerCase()))
    if (filterStatus !== '全部') rows = rows.filter((r) => r.status === filterStatus)

    rows.sort((a, b) => {
      const ta = Number(a.orderTime) || 0
      const tb = Number(b.orderTime) || 0
      return (timeSortOrder || 'desc') === 'asc' ? ta - tb : tb - ta
    })

    setCurrentPage(1)
    const total = rows.length
    const totalPage = Math.max(1, Math.ceil(total / pageSize))
    const paged = rows.slice(0, pageSize)
    const statusCounts = rows.reduce((acc: any, r) => {
      if (r.status === 'Pending' || r.status === 'Rejected' || r.status === 'Approved') acc[r.status] = (acc[r.status] || 0) + 1
      return acc
    }, { Pending: 0, Rejected: 0, Approved: 0 })
    const statusCommissions = rows.reduce((acc: any, r) => {
      if (r.status === 'Pending' || r.status === 'Rejected' || r.status === 'Approved') acc[r.status] = (acc[r.status] || 0) + (Number(r.commission) || 0)
      return acc
    }, { Pending: 0, Rejected: 0, Approved: 0 })

    setData((prev) => prev ? ({
      ...prev,
      data: paged,
      total,
      totalPage,
      curPage: 1,
      summary: {
        ...(prev.summary || {}),
        totalAmount: rows.reduce((s, r) => s + (Number(r.saleAmount) || 0), 0),
        totalCommission: rows.reduce((s, r) => s + (Number(r.commission) || 0), 0),
        statusCounts,
        statusCommissions,
      }
    }) : prev)
  }, [filterNetworkId, filterAccountId, debouncedMerchantName, debouncedMcid, debouncedBrandId, filterStatus, pageSize, timeSortOrder, allRows])

  // 文本筛选微防抖：降低大数据量输入卡顿
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedMerchantName(filterMerchantName)
      setDebouncedBrandId(filterBrandId)
      setDebouncedMcid(filterMcid)
    }, 120)
    return () => clearTimeout(t)
  }, [filterMerchantName, filterBrandId, filterMcid])

  // 与表格筛选逻辑一致的全量行（用于 Offer 日汇总，含所有分页）
  const filteredRows = useMemo(() => {
    let rows = [...allRows]
    if (filterNetworkId !== '全部') rows = rows.filter((r: any) => String((r as any).networkId) === filterNetworkId)
    if (filterAccountId !== '全部') rows = rows.filter((r: any) => String((r as any).accountId) === filterAccountId)
    if (debouncedMerchantName.trim()) {
      rows = rows.filter((r) =>
        String(r.merchantName || '').toLowerCase().includes(debouncedMerchantName.trim().toLowerCase())
      )
    }
    if (debouncedBrandId.trim()) {
      rows = rows.filter((r) => String(r.brandId || '').toLowerCase().includes(debouncedBrandId.trim().toLowerCase()))
    }
    if (debouncedMcid.trim()) {
      rows = rows.filter((r) => String(r.mcid || '').toLowerCase().includes(debouncedMcid.trim().toLowerCase()))
    }
    if (filterStatus !== '全部') rows = rows.filter((r) => r.status === filterStatus)
    rows.sort((a, b) => {
      const ta = Number(a.orderTime) || 0
      const tb = Number(b.orderTime) || 0
      return (timeSortOrder || 'desc') === 'asc' ? ta - tb : tb - ta
    })
    return rows
  }, [
    allRows,
    filterNetworkId,
    filterAccountId,
    debouncedMerchantName,
    debouncedMcid,
    debouncedBrandId,
    filterStatus,
    timeSortOrder,
  ])

  // 用于商家悬浮统计：忽略状态筛选，保留其它筛选条件
  const rowsWithoutStatusFilter = useMemo(() => {
    let rows = [...allRows]
    if (filterNetworkId !== '全部') rows = rows.filter((r: any) => String((r as any).networkId) === filterNetworkId)
    if (filterAccountId !== '全部') rows = rows.filter((r: any) => String((r as any).accountId) === filterAccountId)
    if (debouncedMerchantName.trim()) {
      rows = rows.filter((r) =>
        String(r.merchantName || '').toLowerCase().includes(debouncedMerchantName.trim().toLowerCase())
      )
    }
    if (debouncedBrandId.trim()) {
      rows = rows.filter((r) => String(r.brandId || '').toLowerCase().includes(debouncedBrandId.trim().toLowerCase()))
    }
    if (debouncedMcid.trim()) {
      rows = rows.filter((r) => String(r.mcid || '').toLowerCase().includes(debouncedMcid.trim().toLowerCase()))
    }
    return rows
  }, [
    allRows,
    filterNetworkId,
    filterAccountId,
    debouncedMerchantName,
    debouncedMcid,
    debouncedBrandId,
  ])

  const merchantAggView = useMemo(() => {
    const byMerchantName: Record<string, { Pending: number; Rejected: number; Approved: number }> = {}
    const byOfferKey: Record<string, { Pending: number; Rejected: number; Approved: number }> = {}
    const merchantListMap = new Map<string, { mcid: string; brandId: string; merchantName: string }>()

    for (const row of filteredRows) {
      const mcid = String(row.mcid || '').trim()
      const brandId = String(row.brandId || '').trim()
      const merchantName = String(row.merchantName || '').trim()
      const offerKey = offerCompositeKey(mcid, brandId)
      if (!mcid && !brandId) continue
      if (!merchantListMap.has(offerKey)) {
        merchantListMap.set(offerKey, { mcid, brandId, merchantName })
      }
    }

    for (const row of rowsWithoutStatusFilter) {
      const status = row.status
      if (status !== 'Pending' && status !== 'Rejected' && status !== 'Approved') continue

      const merchantName = String(row.merchantName || '').trim()
      const mcid = String(row.mcid || '').trim()
      const brandId = String(row.brandId || '').trim()
      const offerKey = offerCompositeKey(mcid, brandId)

      if (merchantName) {
        if (!byMerchantName[merchantName]) byMerchantName[merchantName] = { Pending: 0, Rejected: 0, Approved: 0 }
        byMerchantName[merchantName][status] += 1
      }
      if (mcid || brandId) {
        if (!byOfferKey[offerKey]) byOfferKey[offerKey] = { Pending: 0, Rejected: 0, Approved: 0 }
        byOfferKey[offerKey][status] += 1
      }
    }

    return {
      byMerchantName,
      byOfferKey,
      merchantList: Array.from(merchantListMap.values()),
    }
  }, [filteredRows, rowsWithoutStatusFilter])

  const offerInsightTotals = useMemo(() => {
    if (!offerInsight) return null
    return computeOfferDayTotals(filteredRows, offerInsight.mcid, offerInsight.brandId)
  }, [filteredRows, offerInsight])

  useEffect(() => {
    setOfferInsight(null)
  }, [allRows])

  // 分页处理
  const handlePageChange = (newPage: number) => {
    if (!data || newPage < 1 || newPage > (data?.totalPage || 1)) return
    setCurrentPage(newPage)
    let rows = [...allRows]
    if (filterNetworkId !== '全部') rows = rows.filter((r: any) => String((r as any).networkId) === filterNetworkId)
    if (filterAccountId !== '全部') rows = rows.filter((r: any) => String((r as any).accountId) === filterAccountId)
    if (debouncedMerchantName.trim()) rows = rows.filter((r) => String(r.merchantName || '').toLowerCase().includes(debouncedMerchantName.trim().toLowerCase()))
    if (debouncedBrandId.trim()) rows = rows.filter((r) => String(r.brandId || '').toLowerCase().includes(debouncedBrandId.trim().toLowerCase()))
    if (debouncedMcid.trim()) rows = rows.filter((r) => String(r.mcid || '').toLowerCase().includes(debouncedMcid.trim().toLowerCase()))
    if (filterStatus !== '全部') rows = rows.filter((r) => r.status === filterStatus)
    rows.sort((a, b) => {
      const ta = Number(a.orderTime) || 0
      const tb = Number(b.orderTime) || 0
      return (timeSortOrder || 'desc') === 'asc' ? ta - tb : tb - ta
    })
    const start = (newPage - 1) * pageSize
    const paged = rows.slice(start, start + pageSize)
    setData((prev) => prev ? ({ ...prev, data: paged, curPage: newPage }) : prev)
  }

  // 计算筛选后的统计数据（前端扩展字段见 useEffect 内 setData）
  const sum = data?.summary as CommissionSummary['summary'] & {
    statusCounts?: Record<string, number>
    statusCommissions?: Record<string, number>
  }
  const filteredStats = data
    ? {
        totalAmount: sum?.totalAmount || 0,
        totalCommission: sum?.totalCommission || 0,
        statusCounts: sum?.statusCounts || { Pending: 0, Rejected: 0, Approved: 0 },
        statusCommissions: sum?.statusCommissions || { Pending: 0, Rejected: 0, Approved: 0 },
      }
    : { totalAmount: 0, totalCommission: 0, statusCounts: {}, statusCommissions: {} }

  const visibleRows = data ? data.data : []

  const renderPaginationPages = () => {
    const totalPages = data?.totalPage || 1
    const pages: Array<number | '...'> = []
    const showPages = 5

    if (totalPages <= showPages + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= showPages; i++) pages.push(i)
        pages.push('...')
        pages.push(totalPages)
      } else if (currentPage >= totalPages - 2) {
        pages.push(1)
        pages.push('...')
        for (let i = totalPages - showPages + 1; i <= totalPages; i++) pages.push(i)
      } else {
        pages.push(1)
        pages.push('...')
        const start = Math.max(2, currentPage - Math.floor(showPages / 2))
        const end = Math.min(totalPages - 1, start + showPages - 1)
        for (let i = start; i <= end; i++) pages.push(i)
        pages.push('...')
        pages.push(totalPages)
      }
    }

    return pages.map((p, idx) => {
      if (p === '...') {
        return (
          <span key={`ellipsis-${idx}`} style={{ padding: '0 6px', color: '#666' }}>
            ...
          </span>
        )
      }
      const pageNum = p
      return (
        <button
          key={pageNum}
          type="button"
          onClick={() => handlePageChange(pageNum)}
          style={{
            padding: '0.5rem 0.85rem',
            border: '1px solid #ddd',
            borderRadius: 6,
            background: currentPage === pageNum ? '#1e66ff' : '#fff',
            color: currentPage === pageNum ? '#fff' : '#111',
            cursor: 'pointer',
            fontWeight: currentPage === pageNum ? 600 : 500,
            minWidth: 40,
          }}
        >
          {pageNum}
        </button>
      )
    })
  }

  const getMerchantStatsForTooltip = () => {
    if (!hoveredMerchantKey) return null
    if (hoveredMerchantKey.startsWith('name:')) {
      const name = hoveredMerchantKey.slice('name:'.length)
      const stats = merchantAggView.byMerchantName?.[name]
      if (!stats) return { title: name, Pending: 0, Rejected: 0, Approved: 0 }
      return { title: name, Pending: stats.Pending || 0, Rejected: stats.Rejected || 0, Approved: stats.Approved || 0 }
    }
    if (hoveredMerchantKey.startsWith('offer:')) {
      const [mcid, brandId] = hoveredMerchantKey.slice('offer:'.length).split('\u0000')
      const stats = merchantAggView.byOfferKey?.[offerCompositeKey(mcid, brandId)]
      const title = [mcid, brandId ? `品牌ID ${brandId}` : '品牌ID -'].filter(Boolean).join(' · ')
      if (!stats) return { title, Pending: 0, Rejected: 0, Approved: 0 }
      return { title, Pending: stats.Pending || 0, Rejected: stats.Rejected || 0, Approved: stats.Approved || 0 }
    }
    return null
  }

  const renderOfferInsightPanel = (mcid: string, brandId: string) => {
    if (!offerInsightTotals) return null
    return (
      <div className={styles.offerInsightPanel}>
        <div className={styles.offerInsightTitle}>
          Offer 日汇总（MCID + 品牌ID）
          <span className={styles.offerInsightMeta}>
            {mcid.trim() || '—'} · {brandId.trim() || '—'}
          </span>
        </div>
        <p className={styles.offerInsightRule}>
          佣金口径：仅统计 Pending + Approved，Rejected 不计入。
        </p>
        <div className={styles.offerInsightGrid}>
          <div className={styles.offerInsightCell}>
            <div className={styles.offerInsightDate}>{offerInsightTotals.yesterday.label}</div>
            <div className={styles.offerInsightSub}>昨天</div>
            <div className={styles.offerInsightAmt}>${offerInsightTotals.yesterday.amount.toFixed(2)}</div>
          </div>
          <div className={styles.offerInsightCell}>
            <div className={styles.offerInsightDate}>{offerInsightTotals.dayBeforeYesterday.label}</div>
            <div className={styles.offerInsightSub}>前天</div>
            <div className={styles.offerInsightAmt}>${offerInsightTotals.dayBeforeYesterday.amount.toFixed(2)}</div>
          </div>
          <div className={styles.offerInsightCell}>
            <div className={styles.offerInsightDate}>{offerInsightTotals.threeDaysAgo.label}</div>
            <div className={styles.offerInsightSub}>大前天</div>
            <div className={styles.offerInsightAmt}>${offerInsightTotals.threeDaysAgo.amount.toFixed(2)}</div>
          </div>
          <div className={styles.offerInsightCell}>
            <div className={styles.offerInsightDate}>{offerInsightTotals.fourDaysAgo.label}</div>
            <div className={styles.offerInsightSub}>大大前天</div>
            <div className={styles.offerInsightAmt}>${offerInsightTotals.fourDaysAgo.amount.toFixed(2)}</div>
          </div>
          <div className={`${styles.offerInsightCell} ${styles.offerInsightCellWide}`}>
            <div className={styles.offerInsightDate}>近 7 天（{offerInsightTotals.last7.labelRange}）</div>
            <div className={styles.offerInsightSub}>含今天共 7 个自然日</div>
            <div className={styles.offerInsightAmt}>${offerInsightTotals.last7.amount.toFixed(2)}</div>
          </div>
        </div>
        <p className={styles.offerInsightFoot}>
          按订单时间的本地自然日汇总；单日卡片不包含今天，仅包含当前查询日期范围内、且通过上方筛选的订单。若某日无单则显示 $0.00。
        </p>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>业绩明细（缓存版本）</h1>
      
      {/* 提示信息 */}
      <div className={styles.notice}>
        <p>⚠️ 本页查询的是数据库缓存的佣金明细，不会实时直连联盟 API。</p>
        <p>✅ 查询日期只用于“查询数据”；“同步数据”固定从 2025-08-01 同步到今天（避免误同步 30 天）。</p>
        <p>📌 同步范围策略：如果你勾选了联盟/账号，同步会仅覆盖这些范围的数据；未勾选则同步所有活跃账号的数据。</p>
      </div>

      {/* 操作按钮 */}
      <div className={styles.actions}>
        <button
          onClick={handleSync}
          disabled={syncing}
          className={styles.syncButton}
        >
          {syncing ? '同步中...' : '同步数据（2025-08-01 至今天）'}
        </button>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => setIsAdvancedVisible(!isAdvancedVisible)}
        >
          {isAdvancedVisible ? '收起高级筛选' : '展开高级筛选'}
        </button>
      </div>

      {/* 消息提示 */}
      {error && <div className={styles.error}>{error}</div>}
      {successMessage && <div className={styles.success}>{successMessage}</div>}
      {syncMessage && <div className={styles.info}>{syncMessage}</div>}
      {warningMessage && <div className={styles.warning}>{warningMessage}</div>}

      {/* 高级筛选（联盟/账号/时间） */}
      {isAdvancedVisible && (
        <div className={styles.filters}>
          <div className={styles.filterGroup}>
            <label>
              联盟：
              <span className={styles.quickActions}>
                <button
                  type="button"
                  className={styles.quickActionBtn}
                  onClick={() => setSelectedNetworkIds(networks.map((n: NetworkConfig) => n.id))}
                >
                  全选
                </button>
                <button
                  type="button"
                  className={styles.quickActionBtn}
                  onClick={() => setSelectedNetworkIds([])}
                >
                  清空
                </button>
              </span>
            </label>
            <div className={styles.checkboxGroup}>
            {networks.map((network: NetworkConfig) => (
                <label key={network.id} className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={selectedNetworkIds.includes(network.id)}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      if (e.target.checked) {
                        setSelectedNetworkIds([...selectedNetworkIds, network.id])
                      } else {
                        setSelectedNetworkIds(selectedNetworkIds.filter(id => id !== network.id))
                      }
                    }}
                  />
                  {network.name}
                </label>
              ))}
            </div>
          </div>

          <div className={styles.filterGroup}>
            <label>
              账号：
              <span className={styles.quickActions}>
                <button
                  type="button"
                  className={styles.quickActionBtn}
                  onClick={() => setSelectedAccountIds(accounts.map((a: NetworkAccount) => a.id))}
                >
                  全选
                </button>
                <button
                  type="button"
                  className={styles.quickActionBtn}
                  onClick={() => setSelectedAccountIds([])}
                >
                  清空
                </button>
              </span>
            </label>
            <div className={styles.checkboxGroup}>
            {accounts.map((account: NetworkAccount) => (
                <label key={account.id} className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={selectedAccountIds.includes(account.id)}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      if (e.target.checked) {
                        setSelectedAccountIds([...selectedAccountIds, account.id])
                      } else {
                        setSelectedAccountIds(selectedAccountIds.filter(id => id !== account.id))
                      }
                    }}
                  />
                  {account.accountName}
                </label>
              ))}
            </div>
          </div>

          <div className={styles.dateSection}>
            <div className={styles.datePresets}>
              <button onClick={() => setDatePreset('today')} className={activeDatePreset === 'today' ? styles.active : ''}>今天</button>
              <button onClick={() => setDatePreset('yesterday')} className={activeDatePreset === 'yesterday' ? styles.active : ''}>昨天</button>
              <button onClick={() => setDatePreset('last7days')} className={activeDatePreset === 'last7days' ? styles.active : ''}>近7天</button>
              <button onClick={() => setDatePreset('last30days')} className={activeDatePreset === 'last30days' ? styles.active : ''}>近30天</button>
              <button onClick={() => setDatePreset('last180days')} className={activeDatePreset === 'last180days' ? styles.active : ''}>近180天</button>
              <button onClick={() => setDatePreset('lastYear')} className={activeDatePreset === 'lastYear' ? styles.active : ''}>近一年</button>
              <button onClick={() => setDatePreset('thisMonth')} className={activeDatePreset === 'thisMonth' ? styles.active : ''}>本月</button>
              <button onClick={() => setDatePreset('lastMonth')} className={activeDatePreset === 'lastMonth' ? styles.active : ''}>上月</button>
            </div>
            <div className={styles.dateInputs}>
              <label>
                开始日期：
                <input
                  type="date"
                  value={beginDate}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setBeginDate(e.target.value)}
                />
              </label>
              <label>
                结束日期：
                <input
                  type="date"
                  value={endDate}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setEndDate(e.target.value)}
                />
              </label>
            </div>
          </div>

          <div className={styles.advancedActions}>
            <button
              onClick={handleQuery}
              disabled={loading || !beginDate || !endDate}
              className={styles.queryButton}
              type="button"
            >
              {loading ? '查询中...' : '查询数据'}
            </button>
          </div>
        </div>
      )}

      {data && (
        <div className={styles.results}>
          <div className={styles.dataListHeader}>
            <div>
              <div className={styles.dataListTitle}>业绩明细</div>
              <p className={styles.dataListHint}>表格较宽时可在下方<strong>左右滑动</strong>，右侧有「日汇总」列，可展开查看该 MCID+品牌 的按日佣金。</p>
            </div>
            <div className={styles.headerBadges}>
              <div className={styles.badge}>销售额：<strong>${filteredStats.totalAmount.toFixed(2)}</strong></div>
              <button
                type="button"
                className={`${styles.badge} ${styles.commissionBadgeBtn}`}
                onClick={() => setIsCommissionExpanded(!isCommissionExpanded)}
              >
                佣金：<strong>${filteredStats.totalCommission.toFixed(2)}</strong>
                <span className={styles.expandTriangle}>{isCommissionExpanded ? '收起' : '展开'}</span>
              </button>
              {(['Pending', 'Rejected', 'Approved'] as const).map(st => (
                <div
                  key={st}
                  className={`${styles.badge} ${filterStatus === st ? styles.badgeActive : ''} ${filterStatus === st ? styles.statusBadgeActive : ''}`}
                >
                  {st}：<strong>{filteredStats.statusCounts[st] || 0}</strong>
                </div>
              ))}
            </div>
            {isCommissionExpanded && (
              <div className={styles.commissionBreakdown}>
                <div>Pending佣金：<strong>${Number(filteredStats.statusCommissions?.Pending || 0).toFixed(2)}</strong></div>
                <div>Rejected佣金：<strong>${Number(filteredStats.statusCommissions?.Rejected || 0).toFixed(2)}</strong></div>
                <div>Approved佣金：<strong>${Number(filteredStats.statusCommissions?.Approved || 0).toFixed(2)}</strong></div>
              </div>
            )}
            <div className={styles.pageSizeSelector}>
              <label>每页显示：</label>
              <select
                value={pageSize}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                  setPageSize(Number(e.target.value))
                  setCurrentPage(1)
                }}
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
            </div>
          </div>

          {filterStatus !== '全部' && merchantAggView.merchantList.length > 0 && (
            <div className={styles.merchantSummary}>
              <div className={styles.merchantSummaryHeader}>
                <div className={styles.merchantSummaryTitle}>筛选结果商家汇总（{merchantAggView.merchantList.length} 个）</div>
                <button
                  type="button"
                  className={styles.merchantSummaryToggle}
                  onClick={() => setIsMerchantSummaryCollapsed((prev) => !prev)}
                >
                  {isMerchantSummaryCollapsed ? '展开汇总' : '折叠汇总'}
                </button>
              </div>
              {!isMerchantSummaryCollapsed && (
                <>
                  <div className={styles.merchantChips}>
                    {merchantAggView.merchantList.map((m: any) => (
                      <div
                        key={offerCompositeKey(m.mcid, m.brandId)}
                        className={styles.merchantSummaryItem}
                      >
                        <div
                          className={styles.merchantChip}
                          onMouseEnter={(e: ReactMouseEvent<HTMLDivElement>) => {
                            cancelTooltipHide()
                            const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
                            setHoveredMerchantKey(`offer:${offerCompositeKey(m.mcid, m.brandId)}`)
                            setTooltipPosition({ top: rect.bottom + 8, left: rect.left })
                          }}
                          onMouseLeave={scheduleTooltipHide}
                        >
                          <span className={styles.merchantChipMain}>{m.mcid || '—'}</span>
                          <span className={styles.merchantChipDivider}>|</span>
                          <span className={styles.merchantChipMeta}>{m.brandId || '—'}</span>
                          <button
                            type="button"
                            className={styles.merchantSummaryExpandBtn}
                            onMouseEnter={cancelTooltipHide}
                            onMouseLeave={scheduleTooltipHide}
                            onClick={() => {
                              const nextRowId = `summary:${offerCompositeKey(m.mcid, m.brandId)}`
                              setHoveredMerchantKey(null)
                              setTooltipPosition(null)
                              setOfferInsight((prev) => {
                                if (prev?.rowId === nextRowId) return null
                                return { rowId: nextRowId, mcid: String(m.mcid ?? ''), brandId: String(m.brandId ?? '') }
                              })
                            }}
                          >
                            {offerInsight?.rowId === `summary:${offerCompositeKey(m.mcid, m.brandId)}` ? '收起' : '展开'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {offerInsight?.rowId?.startsWith('summary:') && (
                    <div className={styles.merchantSummaryInsight}>
                      {renderOfferInsightPanel(offerInsight.mcid, offerInsight.brandId)}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>联盟</th>
                <th>账号</th>
                <th>商家名称</th>
                <th>品牌ID</th>
                <th>MCID</th>
                <th>销售额</th>
                <th>佣金</th>
                <th>状态</th>
                <th className={styles.offerInsightCol}>日汇总</th>
                <th>
                  时间
                  <div className={styles.timeSort}>
                    <button type="button" onClick={() => { setCurrentPage(1); setTimeSortOrder('asc') }}>↑</button>
                    <button type="button" onClick={() => { setCurrentPage(1); setTimeSortOrder('desc') }}>↓</button>
                  </div>
                </th>
              </tr>
              <tr className={styles.filterRow}>
                <th>
                  <select
                    value={filterNetworkId}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => setFilterNetworkId(e.target.value)}
                    className={styles.headerSelect}
                  >
                    <option value="全部">全部</option>
                    {Array.from(new Map(allRows.map((r: any) => [String((r as any).networkId), String((r as any).networkName || '-')])).entries()).map(([id, name]) => (
                      <option key={id} value={id}>{name}</option>
                    ))}
                  </select>
                </th>
                <th>
                  <select
                    value={filterAccountId}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => setFilterAccountId(e.target.value)}
                    className={styles.headerSelect}
                  >
                    <option value="全部">全部</option>
                    {Array.from(new Map(allRows.map((r: any) => [String((r as any).accountId), String((r as any).accountName || '-')])).entries()).map(([id, name]) => (
                      <option key={id} value={id}>{name}</option>
                    ))}
                  </select>
                </th>
                <th>
                  <input
                    type="text"
                    placeholder="筛选..."
                    value={filterMerchantName}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setFilterMerchantName(e.target.value)}
                    className={styles.headerInput}
                  />
                </th>
                <th>
                  <input
                    type="text"
                    placeholder="筛选..."
                    value={filterBrandId}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setFilterBrandId(e.target.value)}
                    className={styles.headerInput}
                  />
                </th>
                <th>
                  <input
                    type="text"
                    placeholder="筛选..."
                    value={filterMcid}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setFilterMcid(e.target.value)}
                    className={styles.headerInput}
                  />
                </th>
                <th></th>
                <th></th>
                <th>
                  <select
                    value={filterStatus}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => setFilterStatus(e.target.value)}
                    className={styles.headerSelect}
                  >
                    <option value="全部">全部</option>
                    <option value="Pending">Pending</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </th>
                <th className={styles.offerInsightCol} aria-label="日汇总筛选占位" />
                <th>
                  <button
                    type="button"
                    className={styles.clearBtn}
                    onClick={() => {
                      setFilterMerchantName('')
                      setFilterBrandId('')
                      setFilterMcid('')
                      setFilterStatus('全部')
                      setFilterNetworkId('全部')
                      setFilterAccountId('全部')
                      setOfferInsight(null)
                    }}
                  >
                    清空
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className={styles.noData}>没有数据</td>
                </tr>
              ) : (
                visibleRows.map((item: UnifiedCommission, rowIndex: number) => (
                  <Fragment key={`${item.id}-${rowIndex}`}>
                  <tr>
                    <td>{(item as any).networkName || '-'}</td>
                    <td>{(item as any).accountName || '-'}</td>
                    <td
                      onMouseEnter={(e: ReactMouseEvent<HTMLTableCellElement>) => {
                        cancelTooltipHide()
                        const name = String(item.merchantName || '').trim()
                        const mcid = String(item.mcid || '').trim()
                        const brandId = String(item.brandId || '').trim()
                        if (!name && !mcid) return
                        const rect = (e.currentTarget as HTMLTableCellElement).getBoundingClientRect()
                        setHoveredMerchantKey(mcid || brandId ? `offer:${offerCompositeKey(mcid, brandId)}` : `name:${name}`)
                        setTooltipPosition({ top: rect.bottom + 8, left: rect.left })
                      }}
                      onMouseLeave={scheduleTooltipHide}
                      className={styles.merchantLink}
                      title="悬浮查看该商家总体状态数量"
                    >
                      {item.merchantName || '-'}
                    </td>
                    <td>{item.brandId || '-'}</td>
                    <td>{item.mcid || '-'}</td>
                    <td>${(item.saleAmount || 0).toFixed(2)}</td>
                    <td>${(item.commission || 0).toFixed(2)}</td>
                    <td>
                      <span className={`${styles.status} ${styles[`status-${item.status?.toLowerCase()}`]}`}>
                        {item.status || '-'}
                      </span>
                    </td>
                    <td className={styles.offerInsightCol}>
                      <button
                        type="button"
                        className={styles.offerInsightBtn}
                        onClick={() => {
                          setOfferInsight((prev) => {
                            if (prev?.rowId === item.id) return null
                            return {
                              rowId: item.id,
                              mcid: String(item.mcid ?? ''),
                              brandId: String(item.brandId ?? ''),
                            }
                          })
                        }}
                      >
                        {offerInsight?.rowId === item.id ? '收起' : '展开'}
                      </button>
                    </td>
                    <td>
                      {item.orderTime
                        ? new Date(item.orderTime).toLocaleString('zh-CN')
                        : '-'}
                    </td>
                  </tr>
                  {offerInsight?.rowId === item.id && offerInsightTotals && (
                    <tr className={styles.offerInsightRow}>
                      <td colSpan={10}>
                        {renderOfferInsightPanel(String(item.mcid || ''), String(item.brandId || ''))}
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
          </div>

          {data.totalPage > 1 && (
            <div className={styles.pagination}>
              <button
                onClick={() => handlePageChange(1)}
                disabled={currentPage === 1}
              >
                首页
              </button>
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                上一页
              </button>
              <div className={styles.pageNumbers}>
                {renderPaginationPages()}
              </div>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === data.totalPage}
              >
                下一页
              </button>
              <button
                onClick={() => handlePageChange(data.totalPage)}
                disabled={currentPage === data.totalPage}
              >
                末页
              </button>
              <span className={styles.pageInfoText}>
                第 {currentPage} / {data.totalPage} 页，共 {data.total} 条
              </span>
            </div>
          )}
        </div>
      )}

      {/* 图表切换按钮 */}
      {data && data.data.length > 0 && (
        <div className={styles.chartToggle}>
          <CommissionChartToggle 
            isVisible={isChartsVisible}
            onToggle={() => setIsChartsVisible(!isChartsVisible)}
          />
        </div>
      )}

      {/* 图表 */}
      {data && data.data.length > 0 && isChartsVisible && (
        <div className={styles.charts}>
          <CommissionReport data={data.data} isChartsVisible={isChartsVisible} />
        </div>
      )}

      {/* Tooltip：Portal + 延迟收起，避免 React/reconcile 与鼠标路径竞态触发 removeChild */}
      {portalReady &&
        hoveredMerchantKey &&
        tooltipPosition &&
        typeof document !== 'undefined' &&
        (() => {
          const stats = getMerchantStatsForTooltip()
          if (!stats) return null
          return createPortal(
            <div
              ref={tooltipRef}
              role="tooltip"
              style={{
                position: 'fixed',
                top: `${tooltipPosition.top}px`,
                left: `${tooltipPosition.left}px`,
                zIndex: 9999,
                background: '#fff',
                border: '1px solid #b9d1ff',
                boxShadow: '0 12px 30px rgba(0,0,0,0.12)',
                borderRadius: 12,
                padding: '14px 16px',
                minWidth: 240,
              }}
              onMouseEnter={cancelTooltipHide}
              onMouseLeave={scheduleTooltipHide}
            >
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#111', marginBottom: 10 }}>
                  {stats.title}
                </div>
                <div style={{ borderTop: '1px solid #eee', paddingTop: 10, display: 'grid', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#666' }}>Pending：</span>
                    <strong>{stats.Pending}笔</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#666' }}>Rejected：</span>
                    <strong>{stats.Rejected}笔</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#666' }}>Approved：</span>
                    <strong>{stats.Approved}笔</strong>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )
        })()}
    </div>
  )
}

