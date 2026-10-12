import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Logo } from './Logo';
import { InstallAppCard } from '@/components/InstallAppCard';
import { buttonVariants } from '@/components/ui/button';
import { useAuth } from '@/store/auth';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/', label: 'Home' },
  { href: '/courses', label: 'Courses' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

export function PublicLayout() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="container-page flex h-16 items-center justify-between">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <NavLink
                key={item.href}
                to={item.href}
                end={item.href === '/'}
                className={({ isActive }) =>
                  cn(
                    'rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                    isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            {user ? (
              <Link to="/app" className={cn(buttonVariants({ size: 'md' }))}>
                Go to dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className={cn(buttonVariants({ variant: 'ghost' }))}>
                  Sign in
                </Link>
                <Link to="/register" className={cn(buttonVariants({ variant: 'primary' }))}>
                  Get started
                </Link>
              </>
            )}
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {open && (
          <div className="border-t border-slate-200 bg-white md:hidden">
            <div className="container-page flex flex-col gap-1 py-3">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  {item.label}
                </Link>
              ))}
              <div className="mt-2 flex gap-2">
                <Link to="/login" onClick={() => setOpen(false)} className={cn(buttonVariants({ variant: 'outline' }), 'flex-1')}>
                  Sign in
                </Link>
                <Link to="/register" onClick={() => setOpen(false)} className={cn(buttonVariants({ variant: 'primary' }), 'flex-1')}>
                  Get started
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      <main id="main" className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="container-page pt-10">
          <InstallAppCard />
        </div>
        <div className="container-page grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Logo />
            <p className="mt-3 max-w-xs text-sm text-slate-500">
              Offline-first, book-based learning for Rwandan TVET and secondary education.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Learn</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li><Link className="hover:text-brand-600" to="/courses">Courses</Link></li>
              <li><Link className="hover:text-brand-600" to="/register">Create account</Link></li>
              <li><Link className="hover:text-brand-600" to="/verify">Verify certificate</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Platform</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li><Link className="hover:text-brand-600" to="/about">About</Link></li>
              <li><Link className="hover:text-brand-600" to="/contact">Contact</Link></li>
              <li><Link className="hover:text-brand-600" to="/privacy">Privacy</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Legal</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li><Link className="hover:text-brand-600" to="/terms">Terms</Link></li>
              <li><Link className="hover:text-brand-600" to="/privacy">Privacy policy</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-200">
          <div className="container-page flex flex-col items-center justify-between gap-2 py-4 text-xs text-slate-400 sm:flex-row">
            <p>© {new Date().getFullYear()} IshConnect LMS. All rights reserved.</p>
            <p>Built for competency-based education.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
