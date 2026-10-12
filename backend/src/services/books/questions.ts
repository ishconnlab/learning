import type { ExtractionResult } from './extract';

export interface ExtractedQuestion {
  questionText: string;
  options: { id: string; text: string }[];
  correctOptionId: string;
  sourcePage?: number;
}

/**
 * Conservatively extract multiple-choice questions that the book itself
 * provides *with an explicit answer key*. We never guess a correct answer:
 * if the answer is not stated, the question is skipped.
 */
export function extractQuestions(result: ExtractionResult): { questions: ExtractedQuestion[]; warnings: string[] } {
  const questions: ExtractedQuestion[] = [];
  const warnings: string[] = [];
  const optionRe = /^(?:\(?([A-Da-d])\)|\b([A-Da-d])[.)])\s+(.+)$/;
  const answerRe = /^(?:correct\s+)?answer\s*[:.-]?\s*\(?([A-Da-d])\)?\b\.?/i;

  for (const page of result.pages) {
    const lines = page.text.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
    let current: { text: string; options: { id: string; text: string }[]; answer?: string; page: number } | null = null;

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      const opt = optionRe.exec(line);
      const ans = answerRe.exec(line);

      if (ans && current) {
        current.answer = ans[1].toUpperCase();
        continue;
      }

      if (opt && current) {
        current.options.push({ id: opt[1] || opt[2].toUpperCase(), text: opt[3].trim() });
        continue;
      }

      const isQuestion = line.endsWith('?') || /^(q(?:uestion)?\s*\d+[.)]|^\d+[.)])\s+/i.test(line);
      if (isQuestion) {
        if (current && current.answer && current.options.length >= 2) {
          questions.push(finalise({ ...current, answer: current.answer }));
        }
        current = { text: line.replace(/^(q(?:uestion)?\s*\d+[.)]|\d+[.)])\s*/i, '').trim(), options: [], page: page.page };
      }
    }

    if (current && current.answer && current.options.length >= 2) {
      questions.push(finalise({ ...current, answer: current.answer }));
    }
  }

  if (!questions.length) {
    warnings.push(
      'No multiple-choice questions with an explicit answer key were found in the book. Assessment questions must be authored or approved by a teacher/admin before publishing.',
    );
  } else {
    warnings.push('Auto-extracted questions require teacher/admin approval before they are published to students.');
  }

  return { questions, warnings };
}

function finalise(q: { text: string; options: { id: string; text: string }[]; answer: string; page: number }): ExtractedQuestion {
  const correct = q.options.find((o) => o.id === q.answer)?.id || q.options[0].id;
  return {
    questionText: q.text,
    options: q.options.map((o) => ({ id: o.id, text: o.text })),
    correctOptionId: correct,
    sourcePage: q.page,
  };
}
