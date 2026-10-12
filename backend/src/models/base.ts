import { model, models, Schema, Document, Types, Model } from 'mongoose';

export type WithTimestamps = { createdAt: Date; updatedAt: Date };

/** Register-or-reuse a Mongoose model (safe for hot-reload and tests). */
export function defineModel<T>(name: string, schema: Schema<T>): Model<T> {
  return (models[name] as Model<T>) || model<T>(name, schema);
}

/**
 * Standard schema options used across all collections:
 * - timestamps
 * - toJSON transform: expose `id`, remove `__v` and internal password/token fields.
 */
export const baseSchemaOptions = {
  timestamps: true,
  toJSON: {
    virtuals: true,
    versionKey: false as const,
    transform(_doc: unknown, ret: Record<string, unknown>) {
      ret.id = String(ret._id);
      delete ret._id;
      delete ret.__v;
      delete ret.passwordHash;
      delete ret.password;
      delete ret.refreshTokenHash;
      delete ret.emailVerificationTokenHash;
      delete ret.passwordResetTokenHash;
      return ret;
    },
  },
  toObject: { virtuals: true, versionKey: false as const },
};

/**
 * Construct an ObjectId from a hex string.
 * Note: some environments ship `bson` without its `.d.ts`, which leaves the
 * ObjectId constructor typed with zero arguments. This cast keeps our own code
 * type-safe regardless. Prefer passing hex strings directly to Mongoose queries
 * (Mongoose casts them automatically) and only use this when a real instance is
 * required.
 */
export function toObjectId(hex: string): Types.ObjectId {
  const Ctor = Types.ObjectId as unknown as new (value: string) => Types.ObjectId;
  return new Ctor(hex);
}

export type Ref<T> = Types.ObjectId | T;

export { Schema, Document, Types };
