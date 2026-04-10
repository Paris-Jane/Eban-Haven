/**
 * Semantic colors aligned with RiskBadge chips on the residents directory
 * (`AdminBadges.tsx` — Low / Medium / High risk pills).
 * Use these anywhere we want the same red–amber–green language as the resident table.
 */
export const RESIDENT_SEMANTIC = {
  neutral: {
    chip: 'border-[#D1D5DB] bg-[#F3F4F6] text-[#4B5563]',
  },
  success: {
    chip: 'border-[#B7E4C7] bg-[#E8F7EE] text-[#166534]',
    text: 'text-[#166534]',
    textBold: 'text-[#14532d]',
    border: 'border-[#B7E4C7]',
    bg: 'bg-[#E8F7EE]',
    bgSoft: 'bg-[#E8F7EE]/50',
    bgSoftHover: 'bg-[#E8F7EE]/70',
    listRow: 'border-[#B7E4C7] bg-[#E8F7EE]/40 hover:bg-[#E8F7EE]/70',
    dot: 'bg-[#166534]',
    /** Softer fill for stacked / wide bars (cohort bar, etc.) — not the dark chip text color. */
    bar: 'bg-[#7aab8c]',
  },
  warning: {
    chip: 'border-[#F3D19C] bg-[#FFF4E5] text-[#9A5B00]',
    text: 'text-[#9A5B00]',
    textBold: 'text-[#7c4700]',
    border: 'border-[#F3D19C]',
    bg: 'bg-[#FFF4E5]',
    bgSoft: 'bg-[#FFF4E5]/50',
    bgSoftHover: 'bg-[#FFF4E5]/80',
    listRow: 'border-[#F3D19C] bg-[#FFF4E5]/50 hover:bg-[#FFF4E5]/80',
    dot: 'bg-[#9A5B00]',
    /** Clear gold-amber for bar segments — avoids muddy brown while staying soft. */
    bar: 'bg-[#e4c65d]',
  },
  danger: {
    chip: 'border-[#F5B5B2] bg-[#FDECEC] text-[#B42318]',
    text: 'text-[#B42318]',
    textBold: 'text-[#991b1b]',
    border: 'border-[#F5B5B2]',
    bg: 'bg-[#FDECEC]',
    bgSoft: 'bg-[#FDECEC]/50',
    bgSoftHover: 'bg-[#FDECEC]/80',
    /** Full class string for selectable list rows (Tailwind JIT sees complete literals). */
    listRow: 'border-[#F5B5B2] bg-[#FDECEC]/50 hover:bg-[#FDECEC]/80',
    dot: 'bg-[#B42318]',
    /** Dusty rose-red for wide fills — less harsh than the danger text hex. */
    bar: 'bg-[#d67b73]',
    outlineButton: 'rounded-lg border border-[#F5B5B2] px-3 py-2 text-sm font-medium text-[#B42318] hover:bg-[#FDECEC]/80',
    outlineButtonWide: 'rounded-lg border border-[#F5B5B2] px-4 py-2 text-sm font-medium text-[#B42318] hover:bg-[#FDECEC]/80',
  },
} as const

export type ResidentSemanticKey = keyof typeof RESIDENT_SEMANTIC

/**
 * Resident Goals tab — donut-inspired accents (teal, navy, ochre, peach). No white strokes on rings.
 * Aligns with goal summary cards and wellbeing chart series.
 */
/** Goal progress rings — palette aligned with resident Goals doughnut (teal / navy / ochre). */
export const RESIDENT_GOAL_RING: Record<'health' | 'education' | 'safety', string> = {
  health: 'stroke-[#3D6D66] dark:stroke-[#5a9e94]',
  education: 'stroke-[#2D424D] dark:stroke-[#5a7582]',
  safety: 'stroke-[#E09E4E] dark:stroke-[#f0b565]',
}

/** Chart series / accents — teal, navy, ochre, peach from the same palette. */
export const RESIDENT_GOAL_CHART = {
  teal: {
    strokeClass: 'stroke-[#3D6D66] dark:stroke-[#5a9e94]',
    fillClass: 'fill-[#3D6D66] dark:fill-[#5a9e94]',
    legendClass: 'bg-[#3D6D66] dark:bg-[#5a9e94]',
  },
  navy: {
    strokeClass: 'stroke-[#2D424D] dark:stroke-[#5a7582]',
    fillClass: 'fill-[#2D424D] dark:fill-[#5a7582]',
    legendClass: 'bg-[#2D424D] dark:bg-[#5a7582]',
  },
  ochre: {
    strokeClass: 'stroke-[#E09E4E] dark:stroke-[#f0b565]',
    fillClass: 'fill-[#E09E4E] dark:fill-[#f0b565]',
    legendClass: 'bg-[#E09E4E] dark:bg-[#f0b565]',
  },
  peach: {
    strokeClass: 'stroke-[#E8A87C] dark:stroke-[#f0c4a8]',
    fillClass: 'fill-[#d9946a] dark:fill-[#f0c4a8]',
    legendClass: 'bg-[#E8A87C] dark:bg-[#f0c4a8]',
  },
} as const
