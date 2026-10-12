import type { ExtractionResult } from './extract';

export interface ProposedBlock {
  type: 'heading' | 'paragraph' | 'list' | 'note';
  text?: string;
  items?: string[];
  sourcePage?: number;
}

export interface ProposedLesson {
  title: string;
  kind: 'theory' | 'guided_practice' | 'independent_practice';
  blocks: ProposedBlock[];
  sourcePage?: number;
}

export interface ProposedActivity {
  title: string;
  kind: 'guided' | 'independent';
  instructions: string;
  steps: string[];
  sourcePage?: number;
}

export interface ProposedModule {
  title: string;
  summary: string;
  learningObjectives: string[];
  lessons: ProposedLesson[];
  activities: ProposedActivity[];
  sourcePage?: number;
}

export interface ProposedCourse {
  title: string;
  author?: string;
  modules: ProposedModule[];
  warnings: string[];
}

interface Line {
  text: string;
  page: number;
}

type LineKind = 'h1' | 'h2' | 'objective' | 'assessment' | 'exercise' | 'content';

const H1 = /^(chapter|unit|module|topic|part)\s+([0-9]+|[IVXLC]+)\b[.:\-\s]*(.*)$/i;
const H2 = /^(section|lesson)\s+([0-9]+(\.[0-9]+)*)\b[.:\-\s]*(.*)$/i;
const NUM = /^([0-9]+(\.[0-9]+){0,3})[.)]?\s+([A-Z][A-Za-z].{2,80})$/;

const OBJECTIVE_TRIGGERS = [/^learning outcomes?/i, /^learning objectives?/i, /^objectives?/i, /^by the end of/i, /^at the end of/i, /^competenc/i];
const ASSESSMENT_TRIGGERS = [/^self[- ]?assessment/i, /^review questions?/i, /^assessment\b/i];
const EXERCISE_TRIGGERS = [/^exercises?\b/i, /^practice\b/i, /^activities\b/i, /^activity\b/i, /^exercices?/i, /^assignment\b/i];

function classify(raw: string): LineKind {
  const text = raw.trim();
  if (text.length <= 90 && H1.test(text)) return 'h1';
  if (text.length <= 90 && H2.test(text)) return 'h2';
  if (text.length <= 90 && NUM.test(text) && /^[0-9]/.test(text)) return 'h2';
  if (text.length <= 70 && OBJECTIVE_TRIGGERS.some((r) => r.test(text))) return 'objective';
  if (text.length <= 70 && ASSESSMENT_TRIGGERS.some((r) => r.test(text))) return 'assessment';
  if (text.length <= 70 && EXERCISE_TRIGGERS.some((r) => r.test(text))) return 'exercise';
  return 'content';
}

function cleanBullet(line: string): string {
  return line.replace(/^([-•*]|\d+[.)]|[a-z][.)])\s+/i, '').trim();
}

function looksLikeBullet(line: string): boolean {
  return /^([-•*]|\d+[.)]|[a-z][.)])\s+/i.test(line.trim());
}

function toLines(result: ExtractionResult): Line[] {
  const lines: Line[] = [];
  for (const page of result.pages) {
    for (const raw of page.text.split(/\r?\n/)) {
      const text = raw.replace(/\s+/g, ' ').trim();
      if (text) lines.push({ text, page: page.page });
    }
  }
  return lines;
}

/**
 * Analyse extracted book text into a proposed course structure using
 * conservative heuristics. It never invents content: modules/lessons mirror the
 * detected chapter/section headings and exercises mirror detected exercise
 * sections. If structure cannot be detected, the result is flagged for the
 * administrator rather than fabricated.
 */
export function analyseBook(result: ExtractionResult, hints: { title?: string; author?: string } = {}): ProposedCourse {
  const lines = toLines(result);
  const warnings: string[] = [];
  const modules: ProposedModule[] = [];

  let currentModule: ProposedModule | null = null;
  let currentLesson: ProposedLesson | null = null;
  let currentActivity: ProposedActivity | null = null;
  let collectingObjectives = false;
  let detectedHeadings = 0;

  const flushLesson = () => {
    if (currentActivity && currentModule) {
      currentActivity.instructions = currentActivity.instructions.trim();
      currentModule.activities.push(currentActivity);
    }
    if (currentLesson && currentModule && currentLesson.blocks.length) {
      currentModule.lessons.push(currentLesson);
    }
    currentActivity = null;
    currentLesson = null;
  };

  const flushModule = () => {
    flushLesson();
    if (currentModule) {
      if (!currentModule.lessons.length && !currentModule.activities.length) {
        currentModule.lessons.push({
          title: 'Overview',
          kind: 'theory',
          blocks: [{ type: 'note', text: 'No content could be automatically attached to this module. Please review the source material.' }],
        });
      }
      modules.push(currentModule);
    }
    currentModule = null;
  };

  const ensureModule = () => {
    if (!currentModule) {
      currentModule = {
        title: hints.title || 'Introduction',
        summary: '',
        learningObjectives: [],
        lessons: [],
        activities: [],
      };
    }
  };

  const ensureLesson = (title: string, kind: ProposedLesson['kind'], page: number) => {
    ensureModule();
    if (!currentLesson || currentLesson.kind !== kind) {
      flushLesson();
      currentLesson = { title, kind, blocks: [], sourcePage: page };
    }
  };

  for (const line of lines) {
    const kind = classify(line.text);

    if (kind === 'h1') {
      flushModule();
      currentModule = { title: normalise(line.text), summary: '', learningObjectives: [], lessons: [], activities: [], sourcePage: line.page };
      detectedHeadings += 1;
      collectingObjectives = false;
      continue;
    }

    if (kind === 'h2') {
      ensureModule();
      flushLesson();
      currentLesson = { title: normalise(line.text), kind: 'theory', blocks: [], sourcePage: line.page };
      detectedHeadings += 1;
      collectingObjectives = false;
      continue;
    }

    if (kind === 'objective') {
      ensureModule();
      collectingObjectives = true;
      continue;
    }

    if (kind === 'assessment' || kind === 'exercise') {
      ensureModule();
      flushLesson();
      currentActivity = {
        title: normalise(line.text),
        kind: kind === 'exercise' ? 'guided' : 'independent',
        instructions: '',
        steps: [],
        sourcePage: line.page,
      };
      collectingObjectives = false;
      continue;
    }

    // content
    if (collectingObjectives) {
      if (looksLikeBullet(line.text)) {
        ensureModule();
        currentModule!.learningObjectives.push(cleanBullet(line.text));
        continue;
      }
      collectingObjectives = false;
    }

    if (currentActivity) {
      const cleaned = cleanBullet(line.text);
      if (looksLikeBullet(line.text)) currentActivity.steps.push(cleaned);
      else currentActivity.instructions += `${line.text} `;
      continue;
    }

    ensureLesson(currentLesson?.title || 'Content', 'theory', line.page);
    currentLesson!.blocks.push({ type: 'paragraph', text: line.text, sourcePage: line.page });
  }

  flushModule();

  if (!modules.length) {
    warnings.push('No usable text structure was detected in this book. Please review the extraction output manually.');
  }
  if (detectedHeadings === 0 && modules.length) {
    warnings.push('No chapter/unit headings were detected; the whole text was placed into a single module for manual review.');
  }
  const practiceSections = modules.reduce((n, m) => n + m.activities.length, 0);
  if (practiceSections === 0) {
    warnings.push('No exercise or practice sections were detected. The administrator must add practical activities; the system will not invent them.');
  }

  return {
    title: hints.title || deriveTitle(lines) || 'Untitled Book',
    author: hints.author,
    modules,
    warnings,
  };
}

function deriveTitle(lines: Line[]): string | null {
  for (const line of lines.slice(0, 20)) {
    if (line.text.length >= 6 && line.text.length <= 120 && /[A-Za-z]/.test(line.text)) {
      return line.text;
    }
  }
  return null;
}

function normalise(raw: string): string {
  return raw.replace(/\s+/g, ' ').replace(/\s*[.:-]\s*$/, '').trim();
}
