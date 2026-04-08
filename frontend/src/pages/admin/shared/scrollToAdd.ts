/** Scroll create form into view (use `scroll-mt-28` on the target for sticky toolbar clearance). Focuses `focusEl` if mounted, else first field in the form. */
export function scrollToAddForm(formId: string, focusEl: HTMLElement | null | undefined) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const form = document.getElementById(formId)
      form?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      window.setTimeout(() => {
        if (focusEl && document.body.contains(focusEl)) {
          focusEl.focus()
          return
        }
        form?.querySelector<HTMLElement>('input:not([type=hidden]), select, textarea')?.focus()
      }, 360)
    })
  })
}
