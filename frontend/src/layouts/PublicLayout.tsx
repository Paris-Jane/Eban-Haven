import { Outlet } from 'react-router-dom'
import { SiteProvider } from '../context/SiteContext'
import { Navigation } from '../components/Navigation'
import { Footer } from '../components/Footer'
import { CookieConsent } from '../components/CookieConsent'

export function PublicLayout() {
  return (
    <SiteProvider>
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="pt-16 lg:pt-20">
          <Outlet />
        </main>
        <Footer />
        <CookieConsent />
      </div>
    </SiteProvider>
  )
}
