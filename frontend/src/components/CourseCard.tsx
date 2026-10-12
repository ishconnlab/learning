import { Link } from 'react-router-dom';
import { Clock, Layers } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Course } from '@/types';

const LEVEL_TONE: Record<string, 'brand' | 'accent' | 'default' | 'warning'> = {
  L3: 'brand',
  L4: 'accent',
  L5: 'warning',
  General: 'default',
};

export function CourseCard({ course, href }: { course: Course; href?: string }) {
  const to = href ?? `/courses/${course.slug || course._id}`;
  return (
    <Link to={to} className="group block">
      <Card className="h-full overflow-hidden transition-shadow hover:shadow-md">
        <div className="flex h-28 items-center justify-between bg-gradient-to-br from-brand-600 to-brand-800 px-5">
          <span className="text-sm font-semibold text-brand-100">{course.category || 'Course'}</span>
          <Badge variant={LEVEL_TONE[course.level] || 'default'}>{course.level}</Badge>
        </div>
        <div className="p-5">
          <h3 className="line-clamp-2 font-semibold text-slate-900 group-hover:text-brand-700">{course.title}</h3>
          {course.summary && <p className="mt-2 line-clamp-2 text-sm text-slate-500">{course.summary}</p>}
          <div className="mt-4 flex items-center gap-4 text-xs text-slate-400">
            {typeof course.moduleCount === 'number' && (
              <span className="inline-flex items-center gap-1">
                <Layers className="h-3.5 w-3.5" />
                {course.moduleCount} modules
              </span>
            )}
            {course.estimatedHours != null && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {course.estimatedHours}h
              </span>
            )}
            {course.status !== 'published' && <Badge variant="outline">Draft</Badge>}
          </div>
        </div>
      </Card>
    </Link>
  );
}
