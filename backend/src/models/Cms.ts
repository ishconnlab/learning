import { Schema, Types } from 'mongoose';
import { baseSchemaOptions, defineModel } from './base';

export interface ICMSPage {
  _id: Types.ObjectId;
  key: string;
  title: string;
  status: 'draft' | 'published';
  publishedContent?: Record<string, unknown>;
  draftContent: Record<string, unknown>;
  seo: {
    title?: string;
    description?: string;
    canonicalUrl?: string;
    ogImageUrl?: string;
  };
  updatedBy?: Types.ObjectId;
  publishedAt?: Date;
  currentRevision?: number;
  createdAt: Date;
  updatedAt: Date;
}

const cmsPageSchema = new Schema<ICMSPage>(
  {
    key: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    status: { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
    publishedContent: { type: Schema.Types.Mixed },
    draftContent: { type: Schema.Types.Mixed, default: {} },
    seo: {
      title: String,
      description: String,
      canonicalUrl: String,
      ogImageUrl: String,
    },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    publishedAt: { type: Date },
    currentRevision: { type: Number, default: 0 },
  },
  baseSchemaOptions,
);

export const CMSPage = defineModel<ICMSPage>('CMSPage', cmsPageSchema);

export interface ICMSRevision {
  _id: Types.ObjectId;
  page: Types.ObjectId;
  pageKey: string;
  revision: number;
  content: Record<string, unknown>;
  seo: Record<string, unknown>;
  note?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const cmsRevisionSchema = new Schema<ICMSRevision>(
  {
    page: { type: Schema.Types.ObjectId, ref: 'CMSPage', required: true, index: true },
    pageKey: { type: String, required: true, index: true },
    revision: { type: Number, required: true },
    content: { type: Schema.Types.Mixed, default: {} },
    seo: { type: Schema.Types.Mixed, default: {} },
    note: String,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  baseSchemaOptions,
);

cmsRevisionSchema.index({ page: 1, revision: 1 }, { unique: true });

export const CMSRevision = defineModel<ICMSRevision>('CMSRevision', cmsRevisionSchema);
