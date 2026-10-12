import type { Lesson, LessonBlock } from '@/types';

function blocksOf(content: Lesson['content']): LessonBlock[] {
  if (!content) return [];
  if (Array.isArray(content)) return content;
  if (Array.isArray(content.blocks)) return content.blocks;
  return [];
}

function Block({ block }: { block: LessonBlock }) {
  switch (block.type) {
    case 'heading': {
      const Tag = block.level === 3 ? 'h3' : 'h2';
      return (
        <Tag className={block.level === 3 ? 'mt-6 text-lg font-semibold text-slate-900' : 'mt-8 text-xl font-bold text-slate-900'}>
          {block.text}
        </Tag>
      );
    }
    case 'list':
      return (
        <ul className="my-3 list-disc space-y-1 pl-6 text-slate-700">
          {(block.items || []).map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
    case 'code':
      return (
        <pre className="my-4 overflow-x-auto rounded-xl bg-slate-900 p-4 text-sm text-slate-100">
          <code>{block.text}</code>
        </pre>
      );
    case 'image':
      return block.url ? (
        <figure className="my-4">
          <img src={block.url} alt={block.text || ''} className="w-full rounded-xl border border-slate-200" loading="lazy" />
          {block.text && <figcaption className="mt-1 text-center text-xs text-slate-400">{block.text}</figcaption>}
        </figure>
      ) : null;
    case 'note':
      return (
        <div className="my-4 rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
          {block.title && <p className="font-semibold">{block.title}</p>}
          <p className="leading-relaxed">{block.text}</p>
        </div>
      );
    case 'quote':
      return <blockquote className="my-4 border-l-4 border-brand-300 pl-4 italic text-slate-600">{block.text}</blockquote>;
    case 'paragraph':
    default:
      return <p className="my-3 leading-relaxed text-slate-700">{block.text}</p>;
  }
}

export function LessonContent({ lesson }: { lesson: Lesson }) {
  const blocks = blocksOf(lesson.content);
  if (!blocks.length) {
    return <p className="text-sm italic text-slate-400">This lesson has no content yet.</p>;
  }
  return (
    <article>
      {blocks.map((block, i) => (
        <Block key={i} block={block} />
      ))}
    </article>
  );
}
