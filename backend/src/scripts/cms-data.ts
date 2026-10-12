import type { Document } from 'mongoose';
import { CMSPage } from '../models';

export interface DefaultPage {
  key: string;
  title: string;
  seo: Record<string, unknown>;
  content: Record<string, unknown>;
}

export const DEFAULT_PAGES: DefaultPage[] = [
  {
    key: 'landing',
    title: 'IshConnect LMS',
    seo: {
      description:
        'IshConnect LMS — a book-based, offline-first learning platform for Rwandan TVET and secondary education.',
    },
    content: {
      hero: {
        eyebrow: 'Offline-first learning',
        title: 'Skills that stay with you, even without the internet',
        subtitle:
          'Structured courses built directly from the official TVET textbooks, with practical activities, assessments and a final project.',
        primaryCta: { label: 'Start learning', href: '/register' },
        secondaryCta: { label: 'Browse courses', href: '/courses' },
      },
      valueProps: [
        {
          title: 'Built from real textbooks',
          body: 'Every module is derived from the official source books, so what you study matches what is taught.',
        },
        {
          title: 'Works offline',
          body: 'Download your course, learn without a connection, and sync your progress automatically when you are back online.',
        },
        {
          title: 'Practice and prove it',
          body: 'Guided practical activities and graded assessments lead to a verifiable certificate.',
        },
      ],
      levels: ['L3', 'L4', 'L5', 'General'],
    },
  },
  {
    key: 'about',
    title: 'About IshConnect',
    seo: { description: 'Our mission and approach to competency-based, offline-first learning.' },
    content: {
      heading: 'About IshConnect LMS',
      body: [
        'IshConnect LMS is an offline-first learning management system built for Rwandan TVET and secondary institutions.',
        'Courses are structured from the official source books and organised into modules, lessons, practical activities, assessments and a comprehensive final project.',
      ],
    },
  },
  {
    key: 'contact',
    title: 'Contact',
    seo: { description: 'Get in touch with the IshConnect team.' },
    content: {
      heading: 'Contact us',
      email: 'support@ishconnect.rw',
      body: 'Reach out for support, partnerships or to request an institution account.',
    },
  },
  {
    key: 'privacy',
    title: 'Privacy Policy',
    seo: { description: 'How we handle your data.' },
    content: {
      heading: 'Privacy Policy',
      sections: [
        { title: 'What we collect', body: 'Account details, enrolment and learning progress needed to operate the platform.' },
        { title: 'How we use it', body: 'To deliver courses, track progress and issue certificates. We do not sell your data.' },
      ],
    },
  },
  {
    key: 'terms',
    title: 'Terms of Service',
    seo: { description: 'Terms and conditions of use.' },
    content: {
      heading: 'Terms of Service',
      body: 'By using IshConnect LMS you agree to use the platform for lawful, educational purposes.',
    },
  },
];

export async function seedDefaultPages(_publish = true): Promise<number> {
  let count = 0;
  for (const page of DEFAULT_PAGES) {
    const existing = await CMSPage.findOne({ key: page.key });
    if (existing) {
      await CMSPage.updateOne(
        { _id: existing._id },
        { $set: { draftContent: page.content, seo: page.seo, title: page.title } },
      );
    } else {
      await CMSPage.create({
        key: page.key,
        title: page.title,
        draftContent: page.content,
        publishedContent: page.content,
        seo: page.seo,
        status: 'published',
        publishedAt: new Date(),
        currentRevision: 1,
      });
    }
    count += 1;
  }
  return count;
}

export type CmsPageDoc = InstanceType<typeof CMSPage> & Document;
