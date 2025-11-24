'use client'

import { useState } from 'react'
import CommissionMonitor from '@/components/CommissionMonitor'
import styles from './page.module.css'

export default function Home() {
  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <h1 className={styles.title}>联盟业绩监控系统</h1>
        <p className={styles.description}>实时监控多个联盟的佣金业绩数据</p>
        <CommissionMonitor />
      </div>
    </main>
  )
}

