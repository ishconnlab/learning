import Dexie, { type Table } from 'dexie';
import type { Module, Lesson, Course, PracticalActivity } from '@/types';

export interface CachedCourse {
  id: string;
  course: Course;
  modules: Module[];
  activities: PracticalActivity[];
  downloadedAt: number;
}

export interface CachedLesson {
  id: string;
  courseId: string;
  moduleId: string;
  lesson: Lesson;
}

export interface QueuedEvent {
  id?: number;
  entityType: 'progress' | 'assessment_attempt' | 'project_submission' | 'assignment_submission';
  clientId: string;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  createdAt: number;
  attempts: number;
  status: 'pending' | 'failed';
  lastError?: string;
}

export interface MetaRecord {
  key: string;
  value: unknown;
}

class IshDatabase extends Dexie {
  courses!: Table<CachedCourse, string>;
  lessons!: Table<CachedLesson, string>;
  syncQueue!: Table<QueuedEvent, number>;
  meta!: Table<MetaRecord, string>;

  constructor() {
    super('ishconnect');
    this.version(1).stores({
      courses: 'id, downloadedAt',
      lessons: 'id, courseId, moduleId',
      syncQueue: '++id, idempotencyKey, entityType, status, createdAt',
      meta: 'key',
    });
  }
}

export const db = new IshDatabase();

export async function cacheCourse(cache: CachedCourse): Promise<void> {
  await db.transaction('rw', db.courses, db.lessons, async () => {
    await db.courses.put(cache);
    await db.lessons.where('courseId').equals(cache.id).delete();
    const rows: CachedLesson[] = [];
    for (const mod of cache.modules) {
      for (const lesson of mod.lessons ?? []) {
        rows.push({ id: lesson._id, courseId: cache.id, moduleId: mod._id, lesson });
      }
    }
    if (rows.length) await db.lessons.bulkPut(rows);
  });
}

export async function isCourseDownloaded(courseId: string): Promise<boolean> {
  const found = await db.courses.get(courseId);
  return Boolean(found);
}

export async function getCachedCourse(courseId: string): Promise<CachedCourse | undefined> {
  return db.courses.get(courseId);
}

export async function removeCachedCourse(courseId: string): Promise<void> {
  await db.transaction('rw', db.courses, db.lessons, async () => {
    await db.courses.delete(courseId);
    await db.lessons.where('courseId').equals(courseId).delete();
  });
}

export async function listDownloadedCourses(): Promise<CachedCourse[]> {
  return db.courses.orderBy('downloadedAt').reverse().toArray();
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `c_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export async function enqueueEvent(event: Omit<QueuedEvent, 'id' | 'createdAt' | 'attempts' | 'status'>): Promise<number> {
  return db.syncQueue.add({ ...event, createdAt: Date.now(), attempts: 0, status: 'pending' });
}

export async function pendingCount(): Promise<number> {
  return db.syncQueue.where('status').equals('pending').count();
}

export async function clearQueue(): Promise<void> {
  await db.syncQueue.clear();
}
