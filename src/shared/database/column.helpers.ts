import { sql } from 'drizzle-orm';
import * as t from 'drizzle-orm/pg-core';
import { v7 as uuidv7 } from 'uuid';

import { users } from './schema/auth';

export const id = {
  id: t
    .uuid()
    .primaryKey()
    .$defaultFn(() => uuidv7()),
};

export const userId = {
  userId: t.uuid().references(() => users.id, { onDelete: 'cascade' }),
};

export const timestamp = () => t.timestamp({ precision: 0, withTimezone: true });

export const timestamps = {
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().$onUpdate(() => sql`now()`),
};

export const integer = () => t.integer().notNull().default(1);

export const amount = () => t.numeric({ precision: 18, scale: 8 }).notNull().default('0');

export const date = {
  date: t.date().notNull().defaultNow(),
};
