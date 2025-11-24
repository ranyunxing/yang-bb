'use client'

import { useState, useEffect } from 'react'
import type { Merchant, MerchantSyncResult } from '@/types'
import styles from './page.module.css'

export default function MerchantsPage() {
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<MerchantSyncResult | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Merchant[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 50

  // 同步广告商数据
  const handleSync = async () => {
    if (isSyncing) return
    
    setIsSyncing(true)
    setSyncResult(null)
    
    try {
      const response = await fetch('/api/merchants/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      const data = await response.json()
      
      if (data.success) {
        setSyncResult(data.data)
        alert(`同步成功！\n共获取 ${data.data.totalMerchants} 个广告商\n成功账号: ${data.data.successAccounts}\n失败账号: ${data.data.failedAccounts}`)
      } else {
        setSyncResult(data.data)
        const errorMsg = data.data.errors?.length > 0 
          ? data.data.errors.map((e: any) => `${e.accountName}: ${e.error}`).join('\n')
          : data.message
        alert(`同步完成，但有错误：\n${errorMsg}`)
      }
    } catch (error: any) {
      console.error('同步失败:', error)
      alert(`同步失败: ${error.message}`)
    } finally {
      setIsSyncing(false)
    }
  }

  // 搜索广告商
  const handleSearch = async (page: number = 1) => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      setTotalCount(0)
      return
    }
    
    setIsSearching(true)
    
    try {
      const offset = (page - 1) * pageSize
      const params = new URLSearchParams({
        query: searchQuery.trim(),
        limit: pageSize.toString(),
        offset: offset.toString(),
      })
      
      const response = await fetch(`/api/merchants/search?${params}`)
      const data = await response.json()
      
      if (data.success) {
        setSearchResults(data.data.merchants)
        setTotalCount(data.data.total)
        setCurrentPage(page)
      } else {
        alert(`搜索失败: ${data.message}`)
      }
    } catch (error: any) {
      console.error('搜索失败:', error)
      alert(`搜索失败: ${error.message}`)
    } finally {
      setIsSearching(false)
    }
  }

  // 处理搜索输入
  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
  }

  // 处理搜索提交
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleSearch(1)
  }

  // 格式化URL显示
  const formatUrl = (url?: string) => {
    if (!url) return '-'
    if (url.length > 50) {
      return url.substring(0, 50) + '...'
    }
    return url
  }

  const totalPages = Math.ceil(totalCount / pageSize)

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <h1 className={styles.title}>广告商管理</h1>
        <p className={styles.description}>管理和搜索广告商数据</p>

        {/* 同步区域 */}
        <div className={styles.syncSection}>
          <h2>数据同步</h2>
          <p className={styles.syncDescription}>
            从所有联盟账号获取最新的广告商列表并更新到数据库
          </p>
          <button
            className={styles.syncButton}
            onClick={handleSync}
            disabled={isSyncing}
          >
            {isSyncing ? '同步中...' : '获取所有广告商数据'}
          </button>
          
          {syncResult && (
            <div className={styles.syncResult}>
              <h3>同步结果</h3>
              <div className={styles.resultStats}>
                <div>总账号数: {syncResult.totalAccounts}</div>
                <div>成功账号: <span className={styles.success}>{syncResult.successAccounts}</span></div>
                <div>失败账号: <span className={styles.error}>{syncResult.failedAccounts}</span></div>
                <div>广告商总数: <strong>{syncResult.totalMerchants}</strong></div>
              </div>
              {syncResult.errors.length > 0 && (
                <div className={styles.errors}>
                  <h4>错误信息:</h4>
                  <ul>
                    {syncResult.errors.map((error, index) => (
                      <li key={index}>
                        <strong>{error.accountName}</strong>: {error.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 搜索区域 */}
        <div className={styles.searchSection}>
          <h2>搜索广告商</h2>
          <p className={styles.searchDescription}>
            通过 URL、广告商名称、MCID 或品牌ID 搜索
          </p>
          <form onSubmit={handleSearchSubmit} className={styles.searchForm}>
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchInputChange}
              placeholder="输入 URL、名称、MCID 或品牌ID..."
              className={styles.searchInput}
            />
            <button
              type="submit"
              disabled={isSearching || !searchQuery.trim()}
              className={styles.searchButton}
            >
              {isSearching ? '搜索中...' : '搜索'}
            </button>
          </form>

          {/* 搜索结果 */}
          {searchResults.length > 0 && (
            <div className={styles.results}>
              <div className={styles.resultsHeader}>
                <h3>搜索结果</h3>
                <div className={styles.resultsCount}>
                  共找到 {totalCount} 个结果
                </div>
              </div>
              
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>广告商名称</th>
                      <th>网站</th>
                      <th>MCID</th>
                      <th>品牌ID</th>
                      <th>联盟</th>
                      <th>账号</th>
                      <th>关系类型</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchResults.map((merchant) => (
                      <tr key={merchant.id}>
                        <td>{merchant.name}</td>
                        <td className={styles.urlCell}>
                          {merchant.website ? (
                            <a
                              href={merchant.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={merchant.website}
                            >
                              {formatUrl(merchant.website)}
                            </a>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td>{merchant.mcid || '-'}</td>
                        <td>{merchant.brandId || '-'}</td>
                        <td>{merchant.networkName || '-'}</td>
                        <td>{merchant.accountName || '-'}</td>
                        <td>{merchant.relationship || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 分页 */}
              {totalPages > 1 && (
                <div className={styles.pagination}>
                  <button
                    onClick={() => handleSearch(currentPage - 1)}
                    disabled={currentPage === 1 || isSearching}
                    className={styles.pageButton}
                  >
                    上一页
                  </button>
                  <span className={styles.pageInfo}>
                    第 {currentPage} 页 / 共 {totalPages} 页
                  </span>
                  <button
                    onClick={() => handleSearch(currentPage + 1)}
                    disabled={currentPage === totalPages || isSearching}
                    className={styles.pageButton}
                  >
                    下一页
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 无结果提示 */}
          {searchQuery && !isSearching && searchResults.length === 0 && totalCount === 0 && (
            <div className={styles.noResults}>
              未找到匹配的广告商
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

