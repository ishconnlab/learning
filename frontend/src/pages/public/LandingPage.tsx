import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Download, ShieldCheck } from 'lucide-react';
import { HeroSection } from '@/components/landing/HeroSection';
import { CourseCard } from '@/components/CourseCard';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/empty-state';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query';
import type { Course } from '@/types';

const VALUE_PROPS = [
  {
    Icon: BookOpen,
    title: 'Official Rwandan textbooks',
    body: 'Every course is built from authorised RTB textbooks with structured modules, practical activities and assessments.',
  },
  {
    Icon: Download,
    title: 'Works online & offline',
    body: 'Install once, download your lessons, and keep learning without a connection — your progress syncs back automatically.',
  },
  {
    Icon: ShieldCheck,
    title: 'Verified certificates',
    body: 'Complete assessments and practical activities to earn certificates anyone can verify with a public link.',
  },
];

export function LandingPage() {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.courses({ featured: true }),
    queryFn: () => api.get<Course[]>('/courses', { query: { page: 1 } }).then((r) => r.data),
  });
  const courses = (data ?? []).slice(0, 3);

  return (
    <>
      <HeroSection />

      <section className="container-page py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Everything you need to learn TVET</h2>
          <p className="mt-3 text-slate-500">
            Built for Rwanda's competency-based curriculum, from Level 3 to Level 5.
          </p>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {VALUE_PROPS.map(({ Icon, title, body }) => (
            <Card key={title} className="h-full p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 font-semibold text-slate-900">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{body}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-y border-slate-100 bg-slate-50/60 py-16">
        <div className="container-page">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">Popular courses</h2>
              <p className="mt-1 text-sm text-slate-500">Start with a subject and level that fits you.</p>
            </div>
            <Link
              to="/courses"
              className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-700"
            >
              Browse all courses <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {isLoading
              ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64 w-full rounded-2xl" />)
              : courses.map((course) => <CourseCard key={course._id} course={course} />)}
          </div>
          {!isLoading && courses.length === 0 && (
            <p className="mt-8 text-sm text-slate-500">Courses are being published — please check back soon.</p>
          )}
        </div>
      </section>

      <section className="container-page py-16">
        <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 to-brand-800 px-8 py-12 text-center sm:px-14">
          <h2 className="text-3xl font-bold tracking-tight text-white">Start learning today</h2>
          <p className="mx-auto mt-3 max-w-xl text-brand-100">
            Create a free account and get instant access to textbooks, practical activities and assessments.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link to="/register" className={cn(buttonVariants({ variant: 'accent', size: 'lg' }))}>
              Create free account
            </Link>
            <Link
              to="/courses"
              className={cn(
                buttonVariants({ size: 'lg' }),
                'bg-white text-brand-700 hover:bg-brand-50',
              )}
            >
              Explore courses
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
