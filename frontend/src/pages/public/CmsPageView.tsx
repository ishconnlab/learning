import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Skeleton } from '@/components/ui/empty-state';
import type { CmsPage } from '@/types';

function renderValue(value: unknown, key: string) {
  if (typeof value === 'string') {
    if (key === 'email') {
      return (
        <p key={key} className="text-slate-700">
          Email: <a className="link-brand" href={`mailto:${value}`}>{value}</a>
        </p>
      );
    }
    return (
      <p key={key} className="text-slate-700">
        {value}
      </p>
    );
  }
  if (Array.isArray(value)) {
    const allStrings = value.every((v) => typeof v === 'string');
    if (allStrings) {
      return (
        <ul key={key} className="list-disc space-y-1 pl-6 text-slate-700">
          {(value as string[]).map((v, i) => (
            <li key={i}>{v}</li>
          ))}
        </ul>
      );
    }
    return (
      <div key={key} className="space-y-4">
        {(value as Record<string, unknown>[]).map((item, i) => (
          <div key={i}>
            {typeof item.title === 'string' && (
              <h3 className="mb-1 text-base font-semibold text-slate-900">{item.title}</h3>
            )}
            {typeof item.body === 'string' && <p className="text-slate-700">{item.body}</p>}
          </div>
        ))}
      </div>
    );
  }
  if (value && typeof value === 'object') {
    return (
      <div key={key} className="space-y-1">
        {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
          <p key={k} className="text-slate-700">
            <span className="font-semibold capitalize">{k.replace(/([A-Z])/g, ' $1')}: </span>
            {typeof v === 'string' ? v : JSON.stringify(v)}
          </p>
        ))}
      </div>
    );
  }
  return null;
}

export function CmsPageView({ pageKey }: { pageKey: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['cms', pageKey],
    queryFn: () => api.get<CmsPage>(`/cms/pages/${pageKey}`).then((r) => r.data),
    staleTime: 10 * 60 * 1000,
  });

  const content = (data?.content || data?.publishedContent || {}) as Record<string, unknown>;
  const heading = (content.heading as string) || data?.title || pageKey;
  const entries = Object.entries(content).filter(([k]) => k !== 'heading');

  return (
    <div className="container-page max-w-3xl py-14">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">{heading}</h1>
      <div className="mt-6 space-y-4">
        {isLoading && (
          <>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-4/5" />
          </>
        )}
        {isError && <p className="text-sm text-red-600">This page could not be loaded.</p>}
        {!isLoading && !isError && entries.map(([key, value]) => renderValue(value, key))}
      </div>
    </div>
  );
}
