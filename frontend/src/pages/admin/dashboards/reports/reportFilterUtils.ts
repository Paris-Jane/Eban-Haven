import type { DateRangePreset } from './reportTypes'

/** Month key as returned by reports API: "YYYY-MM". */
export function parseMonthKey(m: string): Date | null {
  const d = new Date(`${m}-01T12:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

export function monthKeyFromDate(d: Date): string {
  const y = d.getFullYear()
  const mo = d.getMonth() + 1
  return `${y}-${String(mo).padStart(2, '0')}`
}

/** All month keys from sorted trends that fall in the selected window (inclusive month boundaries). */
export function selectMonthsForPreset(
  preset: DateRangePreset,
  customStart: string,
  customEnd: string,
  availableSortedMonths: string[],
): string[] {
  const sorted = [...availableSortedMonths].sort()
  if (sorted.length === 0) return []

  const now = new Date()
  const endKey = monthKeyFromDate(now)

  if (preset === '12m') {
    return sorted.filter((m) => m <= endKey).slice(-12)
  }
  if (preset === '90d') {
    return sorted.filter((m) => m <= endKey).slice(-3)
  }
  if (preset === '30d') {
    return sorted.filter((m) => m <= endKey).slice(-2)
  }
  if (preset === 'custom' && customStart && customEnd) {
    const a = customStart.slice(0, 7)
    const b = customEnd.slice(0, 7)
    return sorted.filter((m) => m >= a && m <= b)
  }
  return sorted
}

/** Prior period months of same length for trend comparison (donations KPI). */
export function priorPeriodMonths(current: string[], allSorted: string[]): string[] {
  if (current.length === 0) return []
  const sorted = [...allSorted].sort()
  const idx = sorted.indexOf(current[0])
  if (idx <= 0) return []
  const len = current.length
  const start = Math.max(0, idx - len)
  return sorted.slice(start, idx)
}

export function sumTrendPhp(
  trends: { month: string; monetaryTotalPhp: number; donationCount: number }[],
  months: Set<string>,
) {
  return trends.reduce(
    (acc, t) => {
      if (!months.has(t.month)) return acc
      return {
        php: acc.php + t.monetaryTotalPhp,
        count: acc.count + t.donationCount,
      }
    },
    { php: 0, count: 0 },
  )
}

export function pctDelta(current: number, prior: number): number | null {
  if (prior === 0) return current === 0 ? null : null
  return ((current - prior) / prior) * 100
}

export function inDateRange(isoDate: string | null | undefined, startMs: number, endMs: number): boolean {
  if (!isoDate) return false
  const t = new Date(isoDate).getTime()
  if (Number.isNaN(t)) return false
  return t >= startMs && t <= endMs
}

/** Range in ms from preset + custom (end = end of day). */
export function rangeBoundsMs(
  preset: DateRangePreset,
  customStart: string,
  customEnd: string,
): { startMs: number; endMs: number } {
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  const start = new Date(end)

  if (preset === '30d') start.setDate(start.getDate() - 30)
  else if (preset === '90d') start.setDate(start.getDate() - 90)
  else if (preset === '12m') start.setFullYear(start.getFullYear() - 1)
  else if (preset === 'custom' && customStart && customEnd) {
    const s = new Date(`${customStart}T00:00:00`)
    const e = new Date(`${customEnd}T23:59:59`)
    return { startMs: s.getTime(), endMs: e.getTime() }
  } else {
    start.setFullYear(start.getFullYear() - 1)
  }

  start.setHours(0, 0, 0, 0)
  return { startMs: start.getTime(), endMs: end.getTime() }
}
