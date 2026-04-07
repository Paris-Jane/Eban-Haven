/**
 * Horizontal brand mark for header / admin shell only (not footer or inline icons).
 */
export function SiteLogoMark({ className }: { className?: string }) {
  return (
    <img
      src="/logo_transparent.png"
      alt=""
      width={180}
      height={36}
      decoding="async"
      className={`h-9 w-auto max-w-[10rem] shrink-0 object-contain object-left sm:max-w-[11rem] ${className ?? ''}`}
    />
  )
}
