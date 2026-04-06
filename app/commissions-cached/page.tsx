'use client'

import { useState, useEffect, type MouseEvent as ReactMouseEvent } from 'react'
import { CommissionSummary, NetworkConfig, NetworkAccount, UnifiedCommission } from '@/types'
import CommissionReport from '@/components/CommissionReport'
import CommissionChartToggle from '@/components/CommissionChartToggle'
import DebugPanel from '@/components/DebugPanel'
import styles from './page.module.css'

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
  
  const [successMessage, setSuccessMessage] = useState('')
  const [warningMessage, setWarningMessage] = useState('')
  const [syncMessage, setSyncMessage] = useState('')
  const [isChartsVisible, setIsChartsVisible] = useState(false)

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
    
    setBeginDate(formatDate(startDate))
    setEndDate(formatDate(endDate))
    setActiveDatePreset(preset)
  }

  // 手动同步数据
  const handleSync = async () => {
    if (!beginDate || !endDate) {
      setError('请先选择日期范围')
      return
    }

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
          beginDate,
          endDate,
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
        // 同步成功后自动查询一次（回到第一页）
        setTimeout(() => {
          handleQuery(1)
        }, 500)
      } else {
        // 部分成功/失败：必须明确告诉用户“数据可能不完整”
        setWarningMessage('本次同步存在错误：数据库中的数据可能不完整，请查看错误详情后重试。')
        setSyncMessage(result.message || `部分成功：已插入 ${result.inserted || 0} 条数据`)

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

  // 查询数据（从数据库）
  const handleQuery = async (
    arg: number | ReactMouseEvent<HTMLButtonElement> | undefined = undefined
  ) => {
    const targetPage = typeof arg === 'number' ? arg : currentPage

    if (!beginDate || !endDate) {
      setError('请选择日期范围')
      return
    }

    setLoading(true)
    setError('')
    setSuccessMessage('')
    setWarningMessage('')

    try {
      const response = await fetch('/api/commissions/cached', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          networkIds: selectedNetworkIds.length > 0 ? selectedNetworkIds : undefined,
          accountIds: selectedAccountIds.length > 0 ? selectedAccountIds : undefined,
          beginDate,
          endDate,
          curPage: targetPage,
          perPage: pageSize,
          merchantName: filterMerchantName || undefined,
          mcid: filterMcid || undefined,
          brandId: filterBrandId || undefined,
          status: filterStatus !== '全部' ? filterStatus : undefined,
          paidStatus: filterPaidStatus !== '全部' ? filterPaidStatus : undefined,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '查询失败')
      }

      const result = (await response.json()) as CommissionSummary
      // 兜底排序：避免因为历史数据单位/混合导致显示顺序“看起来很乱”
      const normalized: CommissionSummary = {
        ...result,
        data: Array.isArray(result.data) ? sortByOrderTimeDesc(result.data) : [],
      }
      setData(normalized)
      setSuccessMessage(`查询成功，共 ${result.total} 条数据`)
    } catch (err: any) {
      console.error('查询失败:', err)
      setError(err.message || '查询失败')
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  // 筛选条件变化时重新查询
  useEffect(() => {
    if (data && (filterMerchantName || filterMcid || filterBrandId || filterStatus !== '全部' || filterPaidStatus !== '全部')) {
      // 使用防抖，避免频繁请求
      const timer = setTimeout(() => {
        setCurrentPage(1)
        handleQuery(1)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [filterMerchantName, filterMcid, filterBrandId, filterStatus, filterPaidStatus, pageSize])

  // 分页处理
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= (data?.totalPage || 1)) {
      setCurrentPage(newPage)
      handleQuery(newPage)
    }
  }

  // 计算筛选后的统计数据
  const filteredStats = data ? {
    totalAmount: data.summary?.totalAmount || 0,
    totalCommission: data.summary?.totalCommission || 0,
    statusCounts: data.data.reduce((acc: Record<string, number>, item: UnifiedCommission) => {
      const status = item.status || 'Unknown'
      acc[status] = (acc[status] || 0) + 1
      return acc
    }, {} as Record<string, number>),
  } : { totalAmount: 0, totalCommission: 0, statusCounts: {} }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>业绩明细（缓存版本）</h1>
      
      {/* 提示信息 */}
      <div className={styles.notice}>
        <p>⚠️ 本页查询的是数据库缓存的佣金明细，不会实时直连联盟 API。</p>
        <p>✅ 使用流程：先选择日期范围（可选联盟/账号）→ 点击“同步数据”写入数据库 → 再点击“查询数据”从数据库筛选/分页查看。</p>
        <p>📌 同步范围策略：如果你勾选了联盟/账号，同步会仅覆盖这些范围的数据；未勾选则按日期范围同步所有活跃账号的数据。</p>
        <p>⏳ 日期跨度越大，同步耗时越久；建议先用小范围验证（如近7天），确认无误后再扩大范围。</p>
      </div>

      {/* 联盟和账号选择 */}
      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <label>联盟：</label>
          <div className={styles.checkboxGroup}>
            {networks.map(network => (
              <label key={network.id} className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={selectedNetworkIds.includes(network.id)}
                  onChange={(e) => {
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
          <label>账号：</label>
          <div className={styles.checkboxGroup}>
            {accounts.map(account => (
              <label key={account.id} className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={selectedAccountIds.includes(account.id)}
                  onChange={(e) => {
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
      </div>

      {/* 日期选择 */}
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
              onChange={(e) => setBeginDate(e.target.value)}
            />
          </label>
          <label>
            结束日期：
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </label>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className={styles.actions}>
        <button
          onClick={handleSync}
          disabled={syncing || !beginDate || !endDate}
          className={styles.syncButton}
        >
          {syncing ? '同步中...' : '同步数据'}
        </button>
        <button
          onClick={handleQuery}
          disabled={loading || !beginDate || !endDate}
          className={styles.queryButton}
        >
          {loading ? '查询中...' : '查询数据'}
        </button>
      </div>

      {/* 消息提示 */}
      {error && <div className={styles.error}>{error}</div>}
      {successMessage && <div className={styles.success}>{successMessage}</div>}
      {syncMessage && <div className={styles.info}>{syncMessage}</div>}
      {warningMessage && <div className={styles.warning}>{warningMessage}</div>}

      {/* 统计数据 */}
      {data && (
        <div className={styles.stats}>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>销售额</div>
            <div className={styles.statValue}>${filteredStats.totalAmount.toFixed(2)}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>佣金</div>
            <div className={styles.statValue}>${filteredStats.totalCommission.toFixed(2)}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Pending</div>
            <div className={styles.statValue}>{filteredStats.statusCounts.Pending || 0}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Approved</div>
            <div className={styles.statValue}>{filteredStats.statusCounts.Approved || 0}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Rejected</div>
            <div className={styles.statValue}>{filteredStats.statusCounts.Rejected || 0}</div>
          </div>
        </div>
      )}

      {/* 筛选条件 */}
      {data && (
        <div className={styles.tableFilters}>
          <input
            type="text"
            placeholder="筛选商家名称..."
            value={filterMerchantName}
            onChange={(e) => setFilterMerchantName(e.target.value)}
            className={styles.filterInput}
          />
          <input
            type="text"
            placeholder="筛选品牌ID..."
            value={filterBrandId}
            onChange={(e) => setFilterBrandId(e.target.value)}
            className={styles.filterInput}
          />
          <input
            type="text"
            placeholder="筛选MCID..."
            value={filterMcid}
            onChange={(e) => setFilterMcid(e.target.value)}
            className={styles.filterInput}
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="全部">全部状态</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
          <select
            value={filterPaidStatus}
            onChange={(e) => setFilterPaidStatus(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="全部">全部支付状态</option>
            <option value="已支付">已支付</option>
            <option value="未支付">未支付</option>
          </select>
        </div>
      )}

      {/* 数据表格 */}
      {data && (
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
                <th>支付状态</th>
                <th>时间</th>
              </tr>
            </thead>
            <tbody>
              {data.data.length === 0 ? (
                <tr>
                  <td colSpan={10} className={styles.noData}>没有数据</td>
                </tr>
              ) : (
                data.data.map((item: UnifiedCommission) => (
                  <tr key={item.id}>
                    <td>{(item as any).networkName || '-'}</td>
                    <td>{(item as any).accountName || '-'}</td>
                    <td>{item.merchantName || '-'}</td>
                    <td>{item.brandId || '-'}</td>
                    <td>{item.mcid || '-'}</td>
                    <td>${(item.saleAmount || 0).toFixed(2)}</td>
                    <td>${(item.commission || 0).toFixed(2)}</td>
                    <td>
                      <span className={`${styles.status} ${styles[`status-${item.status?.toLowerCase()}`]}`}>
                        {item.status || '-'}
                      </span>
                    </td>
                    <td>
                      <span className={item.paidStatus === 1 ? styles.paid : styles.unpaid}>
                        {item.paidStatus === 1 ? '已支付' : item.paidStatus === 0 ? '未支付' : '-'}
                      </span>
                    </td>
                    <td>
                      {item.orderTime
                        ? new Date(item.orderTime).toLocaleString('zh-CN')
                        : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* 分页 */}
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
              <span>
                第 {currentPage} / {data.totalPage} 页，共 {data.total} 条
              </span>
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
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setCurrentPage(1)
                }}
              >
                <option value={20}>每页 20 条</option>
                <option value={50}>每页 50 条</option>
                <option value={100}>每页 100 条</option>
              </select>
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
    </div>
  )
}

