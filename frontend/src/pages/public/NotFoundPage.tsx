import { Link } from 'react-router-dom';
import { Compass, Home, Search } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';

export function NotFoundPage() {
  return (
    <div className="container-page flex min-h-[70vh] flex-col items-center justify-center py-20 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-50 text-brand-600">
        <Compass className="h-8 w-8" aria-hidden="true" />
      </span>
      <p className="mt-6 text-6xl font-black tracking-tight text-slate-900">404</p>
      <h1 className="mt-2 text-xl font-semibold text-slate-800">We couldn&apos;t find that page</h1>
      <p className="mt-2 max-w-md text-sm text-slate-500">
        The page you are looking for may have been moved, renamed, or never existed.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link to="/" className={buttonVariants()}>
          <Home className="h-4 w-4" aria-hidden="true" />
          Back to home
        </Link>
        <Link to="/courses" className={buttonVariants({ variant: 'outline' })}>
          <Search className="h-4 w-4" aria-hidden="true" />
          Browse courses
        </Link>
      </div>
    </div>
  );
}
