'use client'

import styles from './CommissionChartToggle.module.css'

interface CommissionChartToggleProps {
  isVisible: boolean
  onToggle: () => void
}

export default function CommissionChartToggle({ isVisible, onToggle }: CommissionChartToggleProps) {
  return (
    <button
      onClick={onToggle}
      className={styles.toggleButton}
      aria-label={isVisible ? '隐藏图表' : '显示图表'}
    >
      <span className={styles.toggleIcon}>
        {isVisible ? '📊' : '📈'}
      </span>
      <span className={styles.toggleText}>
        {isVisible ? '隐藏图表' : '查看图表'}
      </span>
    </button>
  )
}

