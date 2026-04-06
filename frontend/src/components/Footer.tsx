import { Link } from 'react-router-dom'
import { Heart } from 'lucide-react'
import { useSite } from '../context/SiteContext'

const links = [
  { to: '/', label: 'Home' },
  { to: '/impact', label: 'Our Impact' },
  { to: '/privacy', label: 'Privacy Policy' },
] as const

export function Footer() {
  const year = new Date().getFullYear()
  const { name } = useSite()

  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8 lg:py-16">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <div>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Heart className="h-4 w-4 fill-current text-primary-foreground" />
              </div>
              <span className="font-serif text-lg font-semibold">{name}</span>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              A 501(c)(3) nonprofit providing safe homes, rehabilitation, and hope for girls who are
              survivors of abuse and trafficking.
            </p>
          </div>
          <div>
            <h4 className="mb-4 font-serif text-sm font-semibold">Quick Links</h4>
            <div className="space-y-2">
              {links.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="block text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <h4 className="mb-4 font-serif text-sm font-semibold">Contact</h4>
            <p className="text-sm text-muted-foreground">info@ebanhaven.org</p>
            <p className="mt-1 text-sm text-muted-foreground">+1 (555) HOPE-NOW</p>
          </div>
        </div>
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            © {year} {name}. All rights reserved.
          </p>
          <Link
            to="/privacy"
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Privacy Policy
          </Link>
        </div>
      </div>
    </footer>
  )
}
