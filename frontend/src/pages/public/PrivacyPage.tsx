import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { PUBLIC_CONTACT, SITE_DISPLAY_NAME } from '../../site'

const section = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="mb-3 font-heading text-xl font-semibold text-foreground">{title}</h2>
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
            className="font-heading text-3xl font-bold text-foreground lg:text-4xl"
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
              {SITE_DISPLAY_NAME} (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is a US-based 501(c)(3)
              nonprofit organization that operates safe homes for girls who are survivors of sexual
              abuse or sex trafficking. We are committed to protecting the privacy and safety of all
              individuals whose data we collect, including residents, donors, staff, volunteers, and
              website visitors.
            </p>
            <p>
              This Privacy Policy explains how we collect, use, disclose, and safeguard your
              information when you visit our website, make a donation, or interact with our
              services. Please read this policy carefully.
            </p>
          </Section>

          <Section title="2. Data Controller">
            <p>
              {SITE_DISPLAY_NAME} is the data controller responsible for your personal data. You can contact us at:
            </p>
            <p>
              Email: {PUBLIC_CONTACT.privacyEmail}
              <br />
              Address: {SITE_DISPLAY_NAME}, {PUBLIC_CONTACT.addressLine}
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
            <p className="mt-3">
              <strong className="text-foreground">Public impact statistics:</strong> The public
              &quot;Our Impact&quot; area shows only aggregated, anonymized metrics (counts, averages, trends).
              Individual residents are not identifiable there. Identifiable records remain in authenticated
              staff systems protected by role-based access.
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

          <Section title="5. Legal Basis for Processing (GDPR)">
            <p>Under the General Data Protection Regulation (GDPR), we process personal data based on:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong className="text-foreground">Consent:</strong> When you opt-in to receive
                communications or accept cookies
              </li>
              <li>
                <strong className="text-foreground">Contractual necessity:</strong> When processing
                is necessary to fulfill a donation or service agreement
              </li>
              <li>
                <strong className="text-foreground">Legitimate interests:</strong> When processing is
                necessary for organizational operations and safety
              </li>
              <li>
                <strong className="text-foreground">Legal obligation:</strong> When required by
                applicable law
              </li>
              <li>
                <strong className="text-foreground">Vital interests:</strong> When necessary to
                protect the life or safety of a resident
              </li>
            </ul>
          </Section>

          <Section title="6. Cookies">
            <p>We use cookies and similar technologies to enhance your experience. Types of cookies we use:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong className="text-foreground">Essential cookies:</strong> Required for the
                website to function properly
              </li>
              <li>
                <strong className="text-foreground">Analytics cookies:</strong> Help us understand
                how visitors interact with our site
              </li>
              <li>
                <strong className="text-foreground">Preference cookies:</strong> Remember your
                settings and preferences
              </li>
            </ul>
            <p className="mt-2">
              You can manage cookie preferences through the cookie consent banner displayed when you
              first visit our site, or through your browser settings.
            </p>
          </Section>

          <Section title="7. Data Sharing and Disclosure">
            <p>We do not sell personal data. We may share data with:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                Trusted service providers who assist in our operations (payment processors, hosting
                providers)
              </li>
              <li>Government or law enforcement agencies when required by law</li>
              <li>
                Partner organizations providing direct services to residents (under strict data
                protection agreements)
              </li>
            </ul>
          </Section>

          <Section title="8. Data Security">
            <p>
              We implement industry-standard security measures including encryption (TLS/HTTPS),
              access controls, and regular security assessments. Sensitive resident data is subject to
              additional safeguards including role-based access control and audit logging.
            </p>
          </Section>

          <Section title="9. Data Retention">
            <p>
              We retain personal data only as long as necessary for the purposes described in this
              policy or as required by law. Donor records are retained for the duration of the
              relationship plus 7 years for tax compliance. Resident records are retained according to
              Philippine social welfare regulations.
            </p>
          </Section>

          <Section title="10. Your Rights (GDPR)">
            <p>If you are located in the European Economic Area, you have the right to:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Access your personal data</li>
              <li>Rectify inaccurate data</li>
              <li>Erase your data (&quot;right to be forgotten&quot;)</li>
              <li>Restrict or object to processing</li>
              <li>Data portability</li>
              <li>Withdraw consent at any time</li>
              <li>Lodge a complaint with a supervisory authority</li>
            </ul>
            <p className="mt-2">
              To exercise these rights, contact us at {PUBLIC_CONTACT.privacyEmail}.
            </p>
          </Section>

          <Section title="11. Children&apos;s Privacy">
            <p>
              Our public website is not directed at children under 13. We do not knowingly collect
              personal data from children through our website. Resident data for minors is collected
              and processed exclusively through authorized staff under strict safeguards.
            </p>
          </Section>

          <Section title="12. Changes to This Policy">
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any material
              changes by posting the new policy on this page and updating the &quot;Last updated&quot;
              date.
            </p>
          </Section>

          <Section title="13. Contact Us">
            <p>For questions about this Privacy Policy or our data practices, please contact:</p>
            <p>
              {SITE_DISPLAY_NAME} Privacy Team
              <br />
              Email: {PUBLIC_CONTACT.privacyEmail}
              <br />
              Phone: {PUBLIC_CONTACT.phone}
            </p>
          </Section>
        </motion.div>
      </div>
    </div>
  )
}
