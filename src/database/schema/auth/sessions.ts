import { relations } from 'drizzle-orm';
import * as t from 'drizzle-orm/pg-core';

import { users } from './users';

export const sessions = t.pgTable('sessions', {
  id: t.text().primaryKey(),
  expiresAt: t.timestamp().notNull(),
  token: t.text().notNull().unique(),
  createdAt: t.timestamp().notNull(),
  updatedAt: t.timestamp().notNull(),
  ipAddress: t.text(),
  userAgent: t.text(),
  userId: t
    .text()
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  impersonatedBy: t.text(),
});

export const sessionRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
  impersonator: one(users, {
    fields: [sessions.impersonatedBy],
    references: [users.id],
  }),
}));
