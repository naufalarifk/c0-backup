import { relations } from 'drizzle-orm';
import * as t from 'drizzle-orm/pg-core';

import { users } from './users';

export const twoFactors = t.pgTable('two_factors', {
  id: t.text().primaryKey(),
  secret: t.text().notNull(),
  backupCodes: t.text().notNull(),
  userId: t
    .text()
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
});

export const twoFactorRelations = relations(twoFactors, ({ one }) => ({
  user: one(users, {
    fields: [twoFactors.userId],
    references: [users.id],
  }),
}));
