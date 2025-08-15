import { relations } from 'drizzle-orm';
import * as t from 'drizzle-orm/pg-core';

import { accounts } from './accounts';
import { passkeys } from './passkeys';
import { sessions } from './sessions';
import { ssoProviders } from './sso-providers';
import { twoFactors } from './two-factors';

export const roleEnum = t.pgEnum('role', ['admin', 'user', 'corporate']);

export const users = t.pgTable('users', {
  id: t.text().primaryKey(),
  name: t.text().notNull(),
  email: t.text().notNull().unique(),
  emailVerified: t
    .boolean()
    .$defaultFn(() => false)
    .notNull(),
  image: t.text(),
  createdAt: t
    .timestamp()
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
  updatedAt: t
    .timestamp()
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
  twoFactorEnabled: t.boolean(),
  username: t.text().unique(),
  displayUsername: t.text(),
  phoneNumber: t.text().unique(),
  phoneNumberVerified: t.boolean(),
  role: roleEnum().default('user').notNull(),
  banned: t.boolean(),
  banReason: t.text(),
  banExpires: t.timestamp(),
});

export const userRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  twoFactors: many(twoFactors),
  passkeys: many(passkeys),
  ssoProviders: many(ssoProviders),
}));
