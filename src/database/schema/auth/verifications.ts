import * as t from 'drizzle-orm/pg-core';

export const verifications = t.pgTable('verifications', {
  id: t.text().primaryKey(),
  identifier: t.text().notNull(),
  value: t.text().notNull(),
  expiresAt: t.timestamp().notNull(),
  createdAt: t.timestamp().$defaultFn(() => /* @__PURE__ */ new Date()),
  updatedAt: t.timestamp().$defaultFn(() => /* @__PURE__ */ new Date()),
});
