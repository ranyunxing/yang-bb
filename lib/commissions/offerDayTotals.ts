import type { UnifiedCommission } from '@/types'

/** mcid + brandId 组合键（用于 Map / 比较） */
export function offerCompositeKey(mcid?: string, brandId?: string): string {
  return `${String(mcid ?? '').trim()}\u0000${String(brandId ?? '').trim()}`
}

/** 本地自然日 YYYY-MM-DD */
export function localDateKeyFromTimestamp(ts: number): string | null {
  if (!Number.isFinite(ts) || ts <= 0) return null
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const day = d.getDate()
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** "2026-04-14" -> "4月14日" */
export function formatCnMonthDay(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  if (!y || !m || !d) return dateKey
  return `${m}月${d}日`
}

export interface OfferDayTotalsResult {
  yesterday: { dateKey: string; label: string; amount: number }
  dayBeforeYesterday: { dateKey: string; label: string; amount: number }
  threeDaysAgo: { dateKey: string; label: string; amount: number }
  fourDaysAgo: { dateKey: string; label: string; amount: number }
  last7: {
    startKey: string
    endKey: string
    labelRange: string
    amount: number
  }
}

/**
 * 按本地自然日汇总某 offer（mcid + brandId）的佣金。
 * 近 7 天：含今天在内的 7 个自然日。
 */
export function computeOfferDayTotals(
  rows: UnifiedCommission[],
  mcid: string,
  brandId: string
): OfferDayTotalsResult {
  const mNorm = String(mcid ?? '').trim()
  const bNorm = String(brandId ?? '').trim()

  const match = (r: UnifiedCommission) =>
    String(r.mcid ?? '').trim() === mNorm && String(r.brandId ?? '').trim() === bNorm

  const byDay = new Map<string, number>()
  for (const r of rows) {
    if (!match(r)) continue
    const k = localDateKeyFromTimestamp(Number(r.orderTime) || 0)
    if (!k) continue
    byDay.set(k, (byDay.get(k) || 0) + (Number(r.commission) || 0))
  }

  const now = new Date()
  const y = now.getFullYear()
  const mo = now.getMonth()
  const da = now.getDate()

  const keyFromYmd = (yy: number, mm: number, dd: number) => {
    const d = new Date(yy, mm, dd)
    return localDateKeyFromTimestamp(d.getTime())!
  }

  const yesterdayKey = keyFromYmd(y, mo, da - 1)
  const dayBeforeKey = keyFromYmd(y, mo, da - 2)
  const threeDaysAgoKey = keyFromYmd(y, mo, da - 3)
  const fourDaysAgoKey = keyFromYmd(y, mo, da - 4)

  let last7Amount = 0
  for (let i = 0; i < 7; i++) {
    const k = keyFromYmd(y, mo, da - 6 + i)
    last7Amount += byDay.get(k) || 0
  }

  const start7Key = keyFromYmd(y, mo, da - 6)
  const end7Key = keyFromYmd(y, mo, da)
  const shortMd = (dk: string) => {
    const parts = dk.split('-')
    const mm = Number(parts[1])
    const dd = Number(parts[2])
    if (!mm || !dd) return dk
    return `${mm}/${dd}`
  }
  const labelRange = `${shortMd(start7Key)}–${shortMd(end7Key)}`

  return {
    yesterday: {
      dateKey: yesterdayKey,
      label: formatCnMonthDay(yesterdayKey),
      amount: byDay.get(yesterdayKey) || 0,
    },
    dayBeforeYesterday: {
      dateKey: dayBeforeKey,
      label: formatCnMonthDay(dayBeforeKey),
      amount: byDay.get(dayBeforeKey) || 0,
    },
    threeDaysAgo: {
      dateKey: threeDaysAgoKey,
      label: formatCnMonthDay(threeDaysAgoKey),
      amount: byDay.get(threeDaysAgoKey) || 0,
    },
    fourDaysAgo: {
      dateKey: fourDaysAgoKey,
      label: formatCnMonthDay(fourDaysAgoKey),
      amount: byDay.get(fourDaysAgoKey) || 0,
    },
    last7: {
      startKey: start7Key,
      endKey: end7Key,
      labelRange,
      amount: last7Amount,
    },
  }
}
