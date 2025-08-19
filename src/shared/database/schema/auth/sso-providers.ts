import { relations } from 'drizzle-orm';
import * as t from 'drizzle-orm/pg-core';

import { users } from './users';

export const ssoProviders = t.pgTable('sso_providers', {
  id: t.text().primaryKey(),
  issuer: t.text().notNull(),
  oidcConfig: t.text(),
  samlConfig: t.text(),
  userId: t.text().references(() => users.id, { onDelete: 'cascade' }),
  providerId: t.text().notNull().unique(),
  organizationId: t.text(),
  domain: t.text().notNull(),
});

export const ssoProviderRelations = relations(ssoProviders, ({ one }) => ({
  user: one(users, {
    fields: [ssoProviders.userId],
    references: [users.id],
  }),
}));
