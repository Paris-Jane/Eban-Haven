import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, BookOpen, Heart, Home, UserRound } from 'lucide-react'
import { getImpactSummary, type PublicImpactSummary } from '../api/impact'
import { IMAGES, SITE_DISPLAY_NAME } from '../site'

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7 } },
}

const fallbackStats = [
  { value: '—', label: 'Total girls helped' },
  { value: '—', label: 'Safe homes' },
  { value: '—', label: 'Average Education progress' },
  { value: '—', label: 'Community partners' },
] as const

const programs = [
  {
    icon: Home,
    title: 'Safe Shelter',
    description:
      'Secure, nurturing homes where girls can begin their journey of healing in a protected environment.',
  },
  {
    icon: Heart,
    title: 'Counseling & Therapy',
    description:
      'Structured counseling sessions and trauma-informed care guided by professional social workers.',
  },
  {
    icon: BookOpen,
    title: 'Education',
    description:
      'Bridge programs, literacy support, vocational training, and academic advancement opportunities.',
  },
  {
    icon: UserRound,
    title: 'Reintegration',
    description:
      'Careful preparation and support for family reunification, foster care, or independent living.',
  },
] as const

const stagger = {
  visible: { transition: { staggerChildren: 0.15 } },
}

const staggerMission = {
  visible: { transition: { staggerChildren: 0.12 } },
}

const itemMission = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7 } },
}

/* Reference: shadcn Button size lg + rounded-lg (--radius 0.75rem) */
const btnPrimary =
  'inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-accent px-8 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 lg:text-base'
const btnOutlineLight =
  'inline-flex h-11 items-center justify-center rounded-lg border border-white/30 bg-transparent px-8 text-sm font-medium text-white transition-colors hover:bg-white/10 lg:text-base'

function statsFromImpact(i: PublicImpactSummary) {
  return [
    { value: String(i.activeResidents), label: 'Total girls helped' },
    { value: String(i.safehouseCount), label: 'Active safehouses' },
    { value: `${i.avgEducationProgressPercent.toFixed(0)}%`, label: 'Avg. education progress' },
    { value: String(i.supporterCount), label: 'Community partners' },
  ] as const
}

export function HomePage() {
  const [impact, setImpact] = useState<PublicImpactSummary | null>(null)
  useEffect(() => {
    let cancelled = false
    void getImpactSummary()
      .then((d) => {
        if (!cancelled) setImpact(d)
      })
      .catch(() => {
        /* keep fallback */
      })
    return () => {
      cancelled = true
    }
  }, [])

  const stats = impact ? statsFromImpact(impact) : fallbackStats

  return (
    <div>
      <section className="relative flex min-h-[85vh] items-center overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={IMAGES.hero}
            alt="Warm sunrise light streaming through a window, symbolizing hope and new beginnings"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-foreground/80 via-foreground/50 to-transparent" />
        </div>
        <div className="relative mx-auto max-w-7xl px-6 py-24 lg:px-8 lg:py-32">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={stagger}
            className="max-w-2xl"
          >
            <motion.div
              variants={fadeUp}
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 backdrop-blur-sm"
            >
              <Heart className="h-3.5 w-3.5 fill-current text-accent" />
              <span className="text-xs font-medium text-white/90">501(c)(3) Nonprofit Organization</span>
            </motion.div>
            <motion.h1
              variants={fadeUp}
              className="font-heading text-4xl font-bold leading-tight text-white md:text-5xl lg:text-6xl"
            >
              Every girl deserves
              <span className="block text-accent">a safe haven</span>
            </motion.h1>
            <motion.p
              variants={fadeUp}
              className="mt-6 max-w-xl text-base leading-relaxed text-white/80 lg:text-lg"
            >
              {SITE_DISPLAY_NAME} provides safe homes, rehabilitation, and healing for girls who are
              survivors of abuse and trafficking. Together, we can restore hope and transform lives.
            </motion.p>
            <motion.div variants={fadeUp} className="mt-8 flex flex-wrap gap-4">
              <Link to="/impact" className={btnPrimary}>
                See Our Impact
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/login" className={btnOutlineLight}>
                Login
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <section className="relative z-10 -mt-12 mx-auto max-w-5xl px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="rounded-2xl border border-border bg-card p-8 shadow-xl lg:p-10"
        >
          <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <p className="font-heading text-3xl font-bold text-primary lg:text-4xl">{s.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      <section className="py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-20">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-100px' }}
              variants={staggerMission}
            >
              <motion.span
                variants={itemMission}
                className="text-xs font-semibold uppercase tracking-widest text-accent"
              >
                Our Mission
              </motion.span>
              <motion.h2
                variants={itemMission}
                className="mt-3 font-heading text-3xl font-bold leading-tight text-foreground lg:text-4xl"
              >
                Restoring hope, one life at a time
              </motion.h2>
              <motion.p
                variants={itemMission}
                className="mt-6 leading-relaxed text-muted-foreground"
              >
                {SITE_DISPLAY_NAME} contracts with in-country individuals and organizations to
                provide safehouses and comprehensive rehabilitation services. Our holistic approach
                addresses every aspect of recovery — from immediate safety and counseling to
                education, health services, and reintegration planning.
              </motion.p>
              <motion.p
                variants={itemMission}
                className="mt-4 leading-relaxed text-muted-foreground"
              >
                We believe every girl deserves the chance to heal, grow, and thrive. Our dedicated team
                of social workers, educators, and partners works tirelessly to ensure no one falls
                through the cracks.
              </motion.p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.7 }}
              className="relative"
            >
              <div className="overflow-hidden rounded-2xl shadow-2xl">
                <img
                  src={IMAGES.mission}
                  alt="Hands gently holding a paper origami crane, symbolizing hope and healing"
                  className="h-80 w-full object-cover lg:h-96"
                />
              </div>
              <div className="absolute -bottom-4 -left-4 -z-10 h-24 w-24 rounded-2xl bg-accent/20" />
              <div className="absolute -right-4 -top-4 -z-10 h-32 w-32 rounded-2xl bg-primary/10" />
            </motion.div>
          </div>
        </div>
      </section>

      <section className="bg-background py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto mb-10 max-w-3xl text-center">
            <span className="text-xs font-semibold uppercase tracking-widest text-accent">Ghana focus</span>
            <h2 className="mt-3 font-heading text-3xl font-bold text-foreground lg:text-4xl">
              Women and girls in Ghana deserve safety and dignity
            </h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              Ghanaian women and girls — especially adolescents — face heightened risks of gender-based violence,
              exploitation, and interrupted education. Poverty, mobility, and uneven access to services can leave
              survivors isolated. {SITE_DISPLAY_NAME} works with trusted in-country partners to provide{' '}
              <strong className="text-foreground">safe shelter</strong>,{' '}
              <strong className="text-foreground">trauma-informed care</strong>, and{' '}
              <strong className="text-foreground">pathways back to school and family</strong> where it is safe to do so.
            </p>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              Investing in girls in Ghana strengthens families, communities, and the leaders of tomorrow. When you
              support {SITE_DISPLAY_NAME}, you help ensure that geography and circumstance do not decide whether a
              child gets to heal.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-muted/50 py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={{
              hidden: { opacity: 0, y: 30 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
            }}
            className="mx-auto mb-16 max-w-2xl text-center"
          >
            <span className="text-xs font-semibold uppercase tracking-widest text-accent">
              What We Do
            </span>
            <h2 className="mt-3 font-heading text-3xl font-bold text-foreground lg:text-4xl">
              Comprehensive care for every girl
            </h2>
            <p className="mt-4 text-muted-foreground">
              Our programs address the full spectrum of needs — from immediate safety to long-term
              empowerment.
            </p>
          </motion.div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {programs.map((p, i) => (
              <motion.div
                key={p.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-50px' }}
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  visible: {
                    opacity: 1,
                    y: 0,
                    transition: { duration: 0.5, delay: i * 0.1 },
                  },
                }}
                className="rounded-2xl border border-border bg-card p-6 transition-shadow hover:shadow-lg lg:p-8"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <p.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-heading text-lg font-semibold text-foreground">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-primary py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-14">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-100px' }}
              variants={fadeUp}
              className="text-center lg:text-left"
            >
              <h2 className="font-heading text-3xl font-bold text-primary-foreground lg:text-4xl">
                Join us in making a difference
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-primary-foreground/80 lg:mx-0">
                Your support helps us provide safe homes, education, counseling, and a path to healing
                for girls in need.
              </p>
              <div className="mt-8 flex justify-center lg:justify-start">
                <Link to="/impact" className={btnPrimary}>
                  Learn How You Can Help
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  )
}
