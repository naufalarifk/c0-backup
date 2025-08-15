import { relations } from 'drizzle-orm';
import * as t from 'drizzle-orm/pg-core';

import { users } from './users';

export const passkeys = t.pgTable('passkeys', {
  id: t.text().primaryKey(),
  name: t.text(),
  publicKey: t.text().notNull(),
  userId: t
    .text()
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  credentialID: t.text('credential_i_d').notNull(),
  counter: t.integer().notNull(),
  deviceType: t.text().notNull(),
  backedUp: t.boolean().notNull(),
  transports: t.text(),
  createdAt: t.timestamp(),
  aaguid: t.text(),
});

export const passkeyRelations = relations(passkeys, ({ one }) => ({
  user: one(users, {
    fields: [passkeys.userId],
    references: [users.id],
  }),
}));
