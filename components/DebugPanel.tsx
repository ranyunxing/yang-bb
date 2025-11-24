'use client'

import { useEffect, useState } from 'react'
import type { CommissionSummary } from '@/types'

interface DebugPanelProps {
  data: CommissionSummary | null
  loading: boolean
  error: string
}

export default function DebugPanel({ data, loading, error }: DebugPanelProps) {
  const [debugInfo, setDebugInfo] = useState<any>({})
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    // 收集调试信息
    const info = {
      timestamp: new Date().toISOString(),
      hasData: !!data,
      dataLength: data?.data?.length || 0,
      total: data?.total || 0,
      summaryExists: !!data?.summary,
      summary: data?.summary || null,
      networks: data?.summary?.networks || {},
      meta: data?.meta || null,
      loading,
      error,
    }
    
    setDebugInfo(info)
    
    // 输出到 Console
    console.group('🐛 LookAny Debug Info')
    console.log('Data Status:', {
      有数据: !!data,
      数据条数: data?.data?.length || 0,
      总记录数: data?.total || 0,
      加载中: loading,
      错误: error || '无',
    })
    
    if (data?.summary) {
      console.log('Summary:', {
        总销售额: `$${(data.summary.totalAmount || 0).toFixed(2)}`,
        总佣金: `$${(data.summary.totalCommission || 0).toFixed(2)}`,
        联盟数: Object.keys(data.summary.networks).length,
      })
    }
    
    if (data?.meta) {
      console.log('Meta:', data.meta)
      if (!data.meta.success && data.meta.errors?.length) {
        console.error('Meta Errors:', data.meta.errors)
      }
      if (data.meta.warnings?.length) {
        console.warn('Meta Warnings:', data.meta.warnings)
      }
      if (data.meta.infos?.length) {
        console.info('Meta Infos:', data.meta.infos)
      }
    }

    if (data?.data && data.data.length > 0) {
      console.log('Sample Data:', data.data[0])
    }
    
    if (error) {
      console.error('Error:', error)
    }
    
    console.groupEnd()
  }, [data, loading, error])

  if (!isOpen && process.env.NODE_ENV === 'production') {
    // 生产环境默认不显示，但始终保持 Console 输出
    return null
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      right: 0,
      width: '400px',
      maxHeight: '400px',
      backgroundColor: 'rgba(0,0,0,0.9)',
      color: '#0f0',
      padding: '10px',
      fontSize: '12px',
      fontFamily: 'monospace',
      overflow: 'auto',
      zIndex: 9999,
      border: '1px solid #0f0'
    }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          float: 'right',
          background: '#0f0',
          color: '#000',
          border: 'none',
          padding: '4px 8px',
          cursor: 'pointer'
        }}
      >
        {isOpen ? '隐藏' : '显示'}调试
      </button>
      
      {isOpen && (
        <div>
          <h4>🐛 Debug Info</h4>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

