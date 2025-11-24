'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import styles from './Navigation.module.css'

export default function Navigation() {
  const pathname = usePathname()
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleLogout = async () => {
    setLoading(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
      router.refresh()
    } catch (error) {
      console.error('登出失败:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <nav className={styles.nav}>
      <div className={styles.container}>
        <div className={styles.logo}>
          <Link href="/">LookAny</Link>
        </div>
        <div className={styles.links}>
          <Link 
            href="/" 
            className={pathname === '/' ? styles.active : ''}
          >
            业绩监控
          </Link>
          <Link 
            href="/merchants" 
            className={pathname === '/merchants' ? styles.active : ''}
          >
            广告商管理
          </Link>
          <button
            onClick={handleLogout}
            className={styles.logoutButton}
            disabled={loading}
          >
            {loading ? '登出中...' : '登出'}
          </button>
        </div>
      </div>
    </nav>
  )
}

