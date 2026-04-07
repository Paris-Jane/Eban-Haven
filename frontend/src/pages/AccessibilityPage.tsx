import { motion } from 'framer-motion'
import { PUBLIC_CONTACT, SITE_DISPLAY_NAME } from '../site'

const fade = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45 } },
}

export function AccessibilityPage() {
  return (
    <div className="py-16 lg:py-24">
      <div className="mx-auto max-w-3xl px-6 lg:px-8">
        <motion.div initial="hidden" animate="visible" variants={fade}>
          <h1 className="font-heading text-4xl font-bold text-foreground">Accessibility</h1>
          <p className="mt-4 text-muted-foreground">
            {SITE_DISPLAY_NAME} is committed to making our public website usable for as many people as possible. We
            aim to follow WCAG 2.1 Level AA practices for structure, contrast, keyboard access, and form labels.
          </p>
          <h2 className="mt-10 font-heading text-xl font-semibold text-foreground">What we do</h2>
          <ul className="mt-4 list-inside list-disc space-y-2 text-muted-foreground">
            <li>Semantic HTML landmarks and heading hierarchy on core pages.</li>
            <li>Visible focus states and descriptive labels on interactive controls.</li>
            <li>Meaningful alternative text on key imagery where content is conveyed visually.</li>
          </ul>
          <h2 className="mt-10 font-heading text-xl font-semibold text-foreground">Staff tools</h2>
          <p className="mt-4 text-muted-foreground">
            The authenticated staff portal prioritizes dense operational data tables and forms. If you need an
            accommodation to complete a workflow, contact your administrator.
          </p>
          <h2 className="mt-10 font-heading text-xl font-semibold text-foreground">Feedback</h2>
          <p className="mt-4 text-muted-foreground">
            To report a barrier or request a reasonable adjustment, email{' '}
            <a href={`mailto:${PUBLIC_CONTACT.accessibilityEmail}`} className="text-primary hover:underline">
              {PUBLIC_CONTACT.accessibilityEmail}
            </a>
            .
          </p>
        </motion.div>
      </div>
    </div>
  )
}
