/** Consistent date display for admin tables (local calendar). */
export function formatAdminDate(iso: string | null | undefined): string {
  if (iso == null || iso === '') return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

/** Parse ISO-ish strings to midnight UTC ms for range compare; invalid => null */
export function parseAdminDateMs(iso: string | null | undefined): number | null {
  if (iso == null || iso === '') return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d.getTime()
}

export function inDateRange(
  rowIso: string | null | undefined,
  fromYmd: string,
  toYmd: string,
): boolean {
  const t = parseAdminDateMs(rowIso)
  if (t == null) return false
  if (fromYmd) {
    const from = new Date(fromYmd + 'T00:00:00').getTime()
    if (t < from) return false
  }
  if (toYmd) {
    const to = new Date(toYmd + 'T23:59:59.999').getTime()
    if (t > to) return false
  }
  return true
}

export function inAmountRange(
  value: number | null | undefined,
  minStr: string,
  maxStr: string,
): boolean {
  if (value == null || !Number.isFinite(value)) return minStr === '' && maxStr === ''
  if (minStr.trim()) {
    const min = parseFloat(minStr)
    if (Number.isFinite(min) && value < min) return false
  }
  if (maxStr.trim()) {
    const max = parseFloat(maxStr)
    if (Number.isFinite(max) && value > max) return false
  }
  return true
}

/** Empty set = match all; otherwise value must be in set (trimmed string compare). */
export function matchesStringMulti(value: string | null | undefined, selected: Set<string>): boolean {
  if (selected.size === 0) return true
  const v = (value ?? '').trim()
  return selected.has(v)
}

export function matchesIdMulti(id: number, selected: Set<number>): boolean {
  if (selected.size === 0) return true
  return selected.has(id)
}

export type TriBool = 'all' | 'yes' | 'no'

export function matchesTriBool(val: boolean, f: TriBool): boolean {
  if (f === 'all') return true
  if (f === 'yes') return val === true
  return val === false
}

export function uniqSortedStrings(values: Iterable<string | null | undefined>): string[] {
  const s = new Set<string>()
  for (const v of values) {
    const t = (v ?? '').trim()
    if (t) s.add(t)
  }
  return [...s].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
}

/** Extract leading integer from strings like "17 Years 6 months" for min/max age filter */
export function parseLeadingInt(s: string | null | undefined): number | null {
  if (s == null || !s.trim()) return null
  const m = s.trim().match(/^(\d+)/)
  if (!m) return null
  const n = parseInt(m[1], 10)
  return Number.isFinite(n) ? n : null
}

export function inPresentAgeRange(
  presentAgeLabel: string | null | undefined,
  minStr: string,
  maxStr: string,
): boolean {
  const n = parseLeadingInt(presentAgeLabel)
  if (n == null) return minStr === '' && maxStr === ''
  return inAmountRange(n, minStr, maxStr)
}
