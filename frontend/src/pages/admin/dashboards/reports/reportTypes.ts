/** Tab ids for Reports & Insights command center. */
export type ReportTabId = 'overview' | 'donors' | 'residents' | 'safehouses' | 'social' | 'impact'

export type DateRangePreset = '30d' | '90d' | '12m' | 'custom'

/** Global filters — client-side today; wire query params / dedicated report APIs when backend supports them. */
export type ReportFiltersState = {
  preset: DateRangePreset
  /** ISO date yyyy-mm-dd when preset === custom */
  customStart: string
  customEnd: string
  safehouseId: number | 'all'
  /** TODO(backend): pass to donations aggregate when API supports donation_type filter */
  donationType: string
  /** 'all' or campaign name from marketing analytics */
  campaign: string
  /** 'all' or platform label (matches PlannedSocialPost.platform) */
  socialPlatform: string
}

export const defaultReportFilters = (): ReportFiltersState => ({
  preset: '12m',
  customStart: '',
  customEnd: '',
  safehouseId: 'all',
  donationType: 'all',
  campaign: 'all',
  socialPlatform: 'all',
})
