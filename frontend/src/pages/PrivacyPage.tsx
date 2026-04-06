import type { ReactNode } from 'react'
import { motion } from 'framer-motion'

const section = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="mb-3 font-serif text-xl font-semibold text-foreground">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed">{children}</div>
    </div>
  )
}

export function PrivacyPage() {
  return (
    <div className="py-20 lg:py-28">
      <div className="mx-auto max-w-3xl px-6 lg:px-8">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
        >
          <motion.h1
            variants={section}
            className="font-serif text-3xl font-bold text-foreground lg:text-4xl"
          >
            Privacy Policy
          </motion.h1>
          <motion.p variants={section} className="mt-2 text-sm text-muted-foreground">
            Last updated: April 6, 2026
          </motion.p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-10 space-y-8 text-muted-foreground"
        >
          <Section title="1. Introduction">
            <p>
              Eban Haven (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is a US-based 501(c)(3)
              nonprofit organization that operates safe homes for girls who are survivors of sexual
              abuse or sex trafficking. We are committed to protecting the privacy and safety of all
              individuals whose data we collect, including residents, donors, staff, volunteers, and
              website visitors.
            </p>
            <p>
              This Privacy Policy explains how we collect, use, disclose, and safeguard your
              information when you visit our website, make a donation, or interact with our services.
              Please read this policy carefully.
            </p>
          </Section>

          <Section title="2. Data Controller">
            <p>Eban Haven is the data controller responsible for your personal data. You can contact us at:</p>
            <p>
              Email: privacy@ebanhaven.org
              <br />
              Address: Eban Haven, P.O. Box 12345, United States
            </p>
          </Section>

          <Section title="3. Information We Collect">
            <p>
              <strong className="text-foreground">Personal information you provide:</strong>
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Name, email address, and contact information (when you donate or contact us)</li>
              <li>
                Donation history and payment information (processed securely through third-party
                payment processors)
              </li>
              <li>Account credentials (for staff portal access)</li>
            </ul>
            <p className="mt-3">
              <strong className="text-foreground">Information collected automatically:</strong>
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Browser type, IP address, device information</li>
              <li>Pages visited, time spent on pages, referring URL</li>
              <li>Cookies and similar tracking technologies</li>
            </ul>
            <p className="mt-3">
              <strong className="text-foreground">Sensitive data:</strong> We collect and process
              sensitive personal data related to resident case management. This data is strictly
              confidential, access-controlled, and processed only for the legitimate purpose of
              providing rehabilitation services.
            </p>
          </Section>

          <Section title="4. How We Use Your Information">
            <ul className="list-disc space-y-1 pl-5">
              <li>Process donations and send tax receipts</li>
              <li>Communicate organizational updates and impact reports</li>
              <li>Manage and improve our services</li>
              <li>Maintain the safety and security of residents</li>
              <li>Comply with legal obligations</li>
              <li>Analyze website usage to improve user experience</li>
            </ul>
          </Section>

          <Section title="5. Cookies">
            <p>
              We use cookies and similar technologies to enhance your experience. You can manage
              preferences through the cookie banner or your browser settings.
            </p>
          </Section>

          <Section title="6. Contact Us">
            <p>For questions about this Privacy Policy:</p>
            <p>
              Eban Haven Privacy Team
              <br />
              Email: privacy@ebanhaven.org
              <br />
              Phone: +1 (555) HOPE-NOW
            </p>
          </Section>
        </motion.div>
      </div>
    </div>
  )
}
