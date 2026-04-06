import { motion } from 'framer-motion'
import {
  GraduationCap,
  Heart,
  Home,
  UserCheck,
  Users,
} from 'lucide-react'

const fade = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

const stats: {
  icon: typeof Users
  value: string
  label: string
  color: string
}[] = [
  { icon: Users, value: '156', label: 'Girls Currently Served', color: 'text-primary' },
  { icon: Home, value: '6', label: 'Active Safehouses', color: 'text-accent' },
  { icon: GraduationCap, value: '89%', label: 'Education Enrollment', color: 'text-primary' },
  { icon: Heart, value: '94%', label: 'Health Improvement', color: 'text-accent' },
  { icon: UserCheck, value: '72%', label: 'Successful Reintegration', color: 'text-primary' },
  { icon: Users, value: '523', label: 'Total Supporters', color: 'text-accent' },
]

const updates = [
  {
    month: 'March 2026',
    headline: 'New Bridge Program Launches',
    summary:
      'Our new educational bridge program has enrolled 28 residents across three safehouses, providing accelerated learning pathways for girls who missed years of formal education.',
  },
  {
    month: 'February 2026',
    headline: 'Record Donation Month',
    summary:
      'Thanks to our Year-End Hope campaign, we received strong donor support — enabling expansion of counseling services.',
  },
  {
    month: 'January 2026',
    headline: '12 Successful Reunifications',
    summary:
      'Twelve girls were successfully reunified with their families after completing comprehensive rehabilitation programs, with ongoing post-placement monitoring in place.',
  },
] as const

const allocation = [
  {
    pct: '45%',
    area: 'Wellbeing & Counseling',
    desc: 'Trauma-informed therapy, health services, and nutritional support',
  },
  {
    pct: '30%',
    area: 'Education',
    desc: 'Bridge programs, school supplies, vocational training, and tutoring',
  },
  {
    pct: '25%',
    area: 'Operations',
    desc: 'Safehouse maintenance, staff support, transport, and administrative costs',
  },
] as const

const staggerHeader = {
  visible: { transition: { staggerChildren: 0.12 } },
}

const yf = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
}

export function ImpactPage() {
  return (
    <div>
      <section className="relative overflow-hidden py-20 lg:py-28">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
        <div className="relative mx-auto max-w-7xl px-6 text-center lg:px-8">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerHeader}
            className="mx-auto max-w-3xl"
          >
            <motion.span
              variants={yf}
              className="text-xs font-semibold uppercase tracking-widest text-accent"
            >
              Transparency Report
            </motion.span>
            <motion.h1
              variants={yf}
              className="mt-3 font-serif text-4xl font-bold text-foreground lg:text-5xl"
            >
              Our Impact
            </motion.h1>
            <motion.p variants={yf} className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Aggregated, anonymized data showing how your support is making a real difference in the
              lives of girls we serve.
            </motion.p>
          </motion.div>
        </div>
      </section>

      <section className="pb-20 lg:pb-28">
        <div className="mx-auto max-w-6xl px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 lg:gap-6">
            {stats.map((s, t) => (
              <motion.div
                key={s.label}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  visible: {
                    opacity: 1,
                    y: 0,
                    transition: { duration: 0.5, delay: t * 0.08 },
                  },
                }}
                className="rounded-2xl border border-border bg-card p-6 text-center transition-shadow hover:shadow-md lg:p-8"
              >
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <s.icon className={`h-6 w-6 ${s.color}`} />
                </div>
                <p className="font-serif text-3xl font-bold text-foreground lg:text-4xl">{s.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-muted/50 py-20 lg:py-28">
        <div className="mx-auto max-w-4xl px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fade}
            className="mb-16 text-center"
          >
            <span className="text-xs font-semibold uppercase tracking-widest text-accent">
              Monthly Updates
            </span>
            <h2 className="mt-3 font-serif text-3xl font-bold text-foreground lg:text-4xl">
              Impact Snapshots
            </h2>
          </motion.div>
          <div className="space-y-6">
            {updates.map((u, t) => (
              <motion.div
                key={u.month}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={{
                  hidden: { opacity: 0, x: -20 },
                  visible: {
                    opacity: 1,
                    x: 0,
                    transition: { duration: 0.5, delay: t * 0.1 },
                  },
                }}
                className="rounded-2xl border border-border bg-card p-6 lg:p-8"
              >
                <span className="text-xs font-medium text-accent">{u.month}</span>
                <h3 className="mt-2 font-serif text-xl font-semibold text-foreground">
                  {u.headline}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{u.summary}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fade}
            className="mb-16 text-center"
          >
            <span className="text-xs font-semibold uppercase tracking-widest text-accent">
              Your Generosity at Work
            </span>
            <h2 className="mt-3 font-serif text-3xl font-bold text-foreground lg:text-4xl">
              Where donations go
            </h2>
          </motion.div>
          <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-3">
            {allocation.map((a, t) => (
              <motion.div
                key={a.area}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  visible: {
                    opacity: 1,
                    y: 0,
                    transition: { duration: 0.5, delay: t * 0.1 },
                  },
                }}
                className="rounded-2xl border border-border bg-card p-8 text-center"
              >
                <p className="font-serif text-4xl font-bold text-primary">{a.pct}</p>
                <p className="mt-2 font-serif text-lg font-semibold text-foreground">{a.area}</p>
                <p className="mt-2 text-sm text-muted-foreground">{a.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
