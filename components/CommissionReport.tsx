'use client'

import { UnifiedCommission } from '@/types'
import { useMemo, useState } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import styles from './CommissionReport.module.css'

interface CommissionReportProps {
  data: UnifiedCommission[]
}

const COLORS = ['#0070f3', '#00c853', '#ffa726', '#ef5350', '#ab47bc', '#26c6da']

interface CommissionReportExtendedProps extends CommissionReportProps {
  isChartsVisible?: boolean
}

export default function CommissionReport({ data, isChartsVisible: externalVisibility }: CommissionReportExtendedProps) {
  const [internalVisibility, setInternalVisibility] = useState(false)
  const isChartsVisible = externalVisibility !== undefined ? externalVisibility : internalVisibility
  const setIsChartsVisible = externalVisibility !== undefined ? () => {} : setInternalVisibility
  // 按日期聚合数据（用于趋势图）
  const dailyTrend = useMemo(() => {
    const grouped = data.reduce((acc, item) => {
      // 安全地处理日期，避免无效时间值
      if (!item.orderTime || item.orderTime <= 0) return acc
      
      try {
        const dateObj = new Date(item.orderTime * 1000)
        // 检查日期是否有效
        if (isNaN(dateObj.getTime())) return acc
        
        const date = dateObj.toISOString().split('T')[0]
        if (!acc[date]) {
          acc[date] = { date, amount: 0, commission: 0, orders: 0 }
        }
        acc[date].amount += (item.saleAmount || 0)
        acc[date].commission += (item.commission || 0)
        acc[date].orders += 1
      } catch (error) {
        console.error('日期处理错误:', error, item)
      }
      return acc
    }, {} as Record<string, { date: string; amount: number; commission: number; orders: number }>)
    
    return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date))
  }, [data])
  
  // 按商户聚合数据
  const merchantData = useMemo(() => {
    const grouped = data.reduce((acc, item) => {
      const merchant = item.merchantName || 'Unknown'
      if (!acc[merchant]) {
        acc[merchant] = { merchant, amount: 0, commission: 0, orders: 0 }
      }
      acc[merchant].amount += item.saleAmount
      acc[merchant].commission += item.commission
      acc[merchant].orders += 1
      return acc
    }, {} as Record<string, { merchant: string; amount: number; commission: number; orders: number }>)
    
    return Object.values(grouped)
      .sort((a, b) => b.commission - a.commission)
      .slice(0, 5) // Top 5
  }, [data])
  
  // 按状态分组
  const statusData = useMemo(() => {
    const grouped = data.reduce((acc, item) => {
      const status = item.status || 'Unknown'
      if (!acc[status]) {
        acc[status] = { status, value: 0, commission: 0 }
      }
      acc[status].value += 1
      acc[status].commission += item.commission
      return acc
    }, {} as Record<string, { status: string; value: number; commission: number }>)
    
    return Object.values(grouped).map(item => ({
      name: item.status,
      value: item.value,
      commission: item.commission
    }))
  }, [data])
  
  if (!data || data.length === 0) {
    return null
  }
  
  return (
    <div className={styles.container}>
      {/* 图表容器（可滑动显示） */}
      <div className={`${styles.chartsWrapper} ${isChartsVisible ? styles.chartsVisible : ''}`}>
        <div className={styles.chartsGrid}>
        {/* 趋势分析 */}
        <div className={styles.chartCard}>
          <h3 className={styles.chartTitle}>趋势分析</h3>
          <div className={styles.chartContainer}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" height={60} />
                <YAxis 
                  yAxisId="left"
                  tick={{ fontSize: 9 }}
                  width={60}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 9 }}
                  width={60}
                />
                <Tooltip 
                  formatter={(value: number) => `$${value.toFixed(2)}`}
                  labelStyle={{ color: '#333' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} verticalAlign="bottom" />
                <Line 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="amount" 
                  stroke="#0070f3" 
                  strokeWidth={3}
                  name="销售额"
                  dot={false}
                  activeDot={{ r: 6 }}
                />
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="commission" 
                  stroke="#00c853" 
                  strokeWidth={3}
                  name="佣金"
                  dot={false}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        {/* 商户排名 */}
        <div className={styles.chartCard}>
          <h3 className={styles.chartTitle}>商户排名</h3>
          <div className={styles.chartContainer}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={merchantData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 9 }} />
                <YAxis 
                  type="category" 
                  dataKey="merchant" 
                  width={90}
                  tick={{ fontSize: 9 }}
                />
                <Tooltip 
                  formatter={(value: number) => `$${value.toFixed(2)}`}
                  labelStyle={{ color: '#333' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} verticalAlign="bottom" />
                <Bar dataKey="commission" fill="#0070f3" name="佣金" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        {/* 状态统计 */}
        <div className={styles.chartCard}>
          <h3 className={styles.chartTitle}>状态统计</h3>
          <div className={styles.statusChartContainer}>
            {/* 图例在左侧 */}
            <div className={styles.statusList}>
              {statusData.map((item, index) => (
                <div key={item.name} className={styles.statusItem}>
                  <span 
                    className={styles.statusDot} 
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className={styles.statusName}>{item.name}</span>
                  <span className={styles.statusValue}>{item.value}</span>
                </div>
              ))}
            </div>
            {/* 饼图在右侧 */}
            <div className={styles.chartContainerWithList}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={() => ''}
                    outerRadius={85}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}
