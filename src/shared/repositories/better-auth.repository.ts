import {
  assertArrayMapOf,
  assertDefined,
  assertNullableBoolean,
  assertNullableNumber,
  assertNullableString,
  assertProp,
  assertPropBoolean,
  assertPropDefined,
  assertPropNullableBoolean,
  assertPropNullableFunction,
  assertPropNullableNumber,
  assertPropNullableString,
  assertPropNumber,
  assertPropString,
  assertString,
  check,
  isArray,
  isBoolean,
  isFunction,
  isInstanceOf,
  isNullable,
  isNumber,
  isString,
  setPropValue,
} from 'typeshaper';
import { v7 } from 'uuid';

import { BaseRepository } from './base.repository';

export type BetterAuthRecord = Record<string, unknown>;

interface BetterAuthUserInput extends BetterAuthRecord {
  name?: string;
  email?: string;
  email_address?: string;
  emailVerified?: boolean;
  phoneNumber?: string;
  phoneNumberVerified?: boolean;
  createdAt?: Date | string | number;
  updatedAt?: Date | string | number;
  id?: string;
  image?: string | null;
  callbackURL?: string;
}

interface BetterAuthWhereCondition extends BetterAuthRecord {
  field: string;
  value?: unknown;
  operator?: string;
}

const isNullableDateLike = check(isNullable, isNumber, isString, isInstanceOf(Date));

function ensureRecord(value: unknown, context: string): BetterAuthRecord {
  assertDefined(value, `${context} must be defined`);
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${context} must be an object`);
  }
  return value as BetterAuthRecord;
}

function ensureArray(value: unknown, context: string): unknown[] {
  if (!isArray(value)) {
    throw new TypeError(`${context} must be an array`);
  }
  return value;
}

function ensureWhereConditions(where: unknown, context: string): BetterAuthWhereCondition[] {
  const array = ensureArray(where, context);
  assertArrayMapOf(array, function (candidate) {
    const record = ensureRecord(candidate, `${context} item`);
    assertPropString(record, 'field', `${context} field must be a string`);
    if ('operator' in record && record.operator !== undefined) {
      assertPropNullableString(record, 'operator', `${context} operator must be a string`);
    }
    return record as BetterAuthWhereCondition;
  });
  return array as BetterAuthWhereCondition[];
}

function readOptionalString(record: BetterAuthRecord, key: string): string | undefined {
  if (!(key in record)) {
    return undefined;
  }
  assertPropNullableString(record, key);
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
}

function readOptionalStringOrNull(
  record: BetterAuthRecord,
  key: string,
): string | null | undefined {
  if (!(key in record)) {
    return undefined;
  }
  assertPropNullableString(record, key);
  const value = record[key];
  if (value === null) {
    return null;
  }
  return typeof value === 'string' ? value : undefined;
}

function readOptionalBoolean(record: BetterAuthRecord, key: string): boolean | undefined {
  if (!(key in record)) {
    return undefined;
  }
  assertPropNullableBoolean(record, key);
  const value = record[key];
  return typeof value === 'boolean' ? value : undefined;
}

function readOptionalDateInput(
  record: BetterAuthRecord,
  key: string,
): Date | string | number | undefined {
  if (!(key in record)) {
    return undefined;
  }
  assertProp(isNullableDateLike, record, key);
  const value = record[key];
  if (value === null || value === undefined) {
    return undefined;
  }
  return value as Date | string | number;
}

function normalizeDateInput(value: Date | string | number | undefined, fallback: Date): Date {
  if (value === undefined) {
    return fallback;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? fallback : value;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function readOptionalStringOrNumber(
  record: BetterAuthRecord,
  key: string,
): string | number | undefined {
  if (!(key in record)) {
    return undefined;
  }
  assertProp(check(isNullable, isString, isNumber), record, key);
  const value = record[key];
  if (value === null || value === undefined) {
    return undefined;
  }
  if (isString(value) || isNumber(value)) {
    return value;
  }
  return undefined;
}

function readOptionalRecord(value: unknown, context: string): BetterAuthRecord | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  return ensureRecord(value, context);
}

function ensureOptionalStringArray(value: unknown, context: string): string[] {
  if (value === undefined || value === null) {
    return [];
  }
  const array = ensureArray(value, context);
  assertArrayMapOf(array, function (item) {
    assertDefined(item, `${context} item must be defined`);
    if (!isString(item) && !isNumber(item)) {
      throw new TypeError(`${context} item must be a string or number`);
    }
    return item;
  });
  return array.map(item => String(item));
}

function assertStringOrNumber(value: unknown, context: string): asserts value is string | number {
  if (!isString(value) && !isNumber(value)) {
    throw new TypeError(`${context} must be a string or number`);
  }
}

function ensureStringArray(value: unknown, context: string): string[] {
  const array = ensureArray(value, context);
  assertArrayMapOf(array, function (item) {
    assertString(item, `${context} item must be a string`);
    return item;
  });
  return array;
}

function tryToDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!isNaN(date.getTime())) return date;
  }
  return null;
}

function alignBetterAuthUserData(user: unknown) {
  assertDefined(user);
  if ('profile_picture' in user) {
    setPropValue(user, 'image', user.profile_picture ?? null);
  }
  if ('email_verified_date' in user) {
    setPropValue(user, 'emailVerified', !!user.email_verified_date);
    setPropValue(
      user,
      'emailVerifiedDate',
      'email_verified_date' in user && tryToDate(user.email_verified_date),
    );
  }
  if ('phone_number' in user) {
    setPropValue(user, 'phoneNumber', user.phone_number ?? null);
  }
  if ('phone_number_verified' in user) {
    setPropValue(user, 'phoneNumberVerified', !!user.phone_number_verified);
  }
  if ('two_factor_enabled' in user) {
    setPropValue(user, 'twoFactorEnabled', !!user.two_factor_enabled);
  }
  if ('user_type' in user) {
    setPropValue(user, 'userType', user.user_type);
  }
  if ('kyc_status' in user) {
    setPropValue(user, 'kycStatus', user.kyc_status);
  }
  if ('role' in user) {
    setPropValue(user, 'role', user.role);
  }
  if ('created_date' in user) {
    setPropValue(user, 'createdAt', 'created_date' in user && tryToDate(user.created_date));
  }
  if ('updated_date' in user) {
    setPropValue(user, 'updatedAt', 'updated_date' in user && tryToDate(user.updated_date));
  }
}

/**
 * BetterAuthRepository <- BaseRepository
 *
 * Repositories are responsible ONLY for data storage and retrieval.
 * Business logic such as encryption, hashing, TOTP verification, etc.
 * should be handled by services that use this repository.
 */
export abstract class BetterAuthRepository extends BaseRepository {
  async betterAuthCreateUser(data: unknown): Promise<BetterAuthRecord> {
    const payload = ensureRecord(
      data,
      'BetterAuthRepository.betterAuthCreateUser payload',
    ) as BetterAuthUserInput;

    const name = readOptionalString(payload, 'name');
    const email = readOptionalString(payload, 'email');
    const emailAddress = readOptionalString(payload, 'email_address');
    const emailVerified = readOptionalBoolean(payload, 'emailVerified') ?? false;
    const phoneNumber = readOptionalString(payload, 'phoneNumber');
    const phoneNumberVerified = readOptionalBoolean(payload, 'phoneNumberVerified') ?? false;
    const createdAtInput = readOptionalDateInput(payload, 'createdAt');
    const updatedAtInput = readOptionalDateInput(payload, 'updatedAt');
    const id = readOptionalString(payload, 'id');
    const image = readOptionalStringOrNull(payload, 'image');
    const callbackURL = readOptionalString(payload, 'callbackURL');

    if (id) {
      console.warn('Creating user with specific ID is not supported.', id);
    }

    const tx = await this.beginTransaction();
    try {
      const emailValue = emailAddress || email || `user-${Date.now()}@example.com`;
      const now = new Date();
      const createdAtUtc = normalizeDateInput(createdAtInput, now);
      const updatedAtUtc = normalizeDateInput(updatedAtInput, now);

      const rows = await tx.sql`
        INSERT INTO users (name, profile_picture, email, phone_number, phone_number_verified, created_date, updated_date, email_verified_date)
        VALUES (${name}, ${image}, ${emailValue}, ${phoneNumber}, ${phoneNumberVerified}, ${createdAtUtc}, ${updatedAtUtc}, ${emailVerified ? updatedAtUtc : null})
        RETURNING id, name, profile_picture as "image", email, phone_number, phone_number_verified, two_factor_enabled, role, user_type, created_date, updated_date, email_verified_date
      `;

      assertArrayMapOf(rows, function (row) {
        assertDefined(row);
        assertPropString(row, 'email');
        assertProp(check(isNullable, isString, isNumber), row, 'image');
        if (emailAddress) {
          setPropValue(row, 'email_address', row.email);
        }
        if (callbackURL) {
          setPropValue(row, 'callbackURL', callbackURL);
        }
        alignBetterAuthUserData(row);
        return row;
      });

      const user = rows[0];
      assertDefined(user, 'User creation result missing');

      await tx.commitTransaction();

      return user as BetterAuthRecord;
    } catch (error) {
      console.error('BetterAuthRepository', error);
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async betterAuthFindOneUser(where: unknown): Promise<BetterAuthRecord | null> {
    try {
      if (!where) {
        return null;
      }

      const conditions = ensureWhereConditions(
        where,
        'BetterAuthRepository.betterAuthFindOneUser where',
      );

      if (conditions.length === 0) {
        return null;
      }

      const idCondition = conditions.find(condition => condition.field === 'id');
      const emailCondition = conditions.find(
        condition => condition.field === 'email' || condition.field === 'email_address',
      );
      const phoneCondition = conditions.find(condition => condition.field === 'phoneNumber');

      let rows: Array<unknown> = [];
      if (idCondition?.value !== undefined) {
        assertStringOrNumber(idCondition.value, 'betterAuthFindOneUser id value');
        rows = await this.sql`
          SELECT id, name, profile_picture as "image", email, phone_number, phone_number_verified, email_verified_date, two_factor_enabled,
            role, user_type, created_date, updated_date
          FROM users
          WHERE id = ${idCondition.value}
        `;
      } else if (emailCondition?.value !== undefined) {
        const emailValue = emailCondition.value;
        assertString(emailValue, 'betterAuthFindOneUser email value');
        rows = await this.sql`
          SELECT id, name, profile_picture as "image", email, phone_number, phone_number_verified, email_verified_date, two_factor_enabled,
            role, user_type, created_date, updated_date
          FROM users
          WHERE email = ${emailValue}
        `;
      } else if (phoneCondition?.value !== undefined) {
        const phoneValue = phoneCondition.value;
        assertString(phoneValue, 'betterAuthFindOneUser phone value');
        rows = await this.sql`
          SELECT id, name, profile_picture as "image", email, phone_number, phone_number_verified, email_verified_date, two_factor_enabled,
            role, user_type, created_date, updated_date
          FROM users
          WHERE phone_number = ${phoneValue} AND phone_number IS NOT NULL
        `;
      } else {
        console.warn('Find user requires id, email, or phone number condition.');
        return null;
      }

      const hasEmailAddressField = conditions.some(
        condition => condition.field === 'email_address',
      );

      assertArrayMapOf(rows, function (row) {
        assertDefined(row);
        if (hasEmailAddressField && 'email' in row) {
          setPropValue(row, 'email_address', row.email);
        }
        alignBetterAuthUserData(row);
        return row;
      });

      if (rows.length > 0) {
        const user = rows[0];
        assertDefined(user);
        return user as BetterAuthRecord;
      }

      return null;
    } catch (error) {
      console.error('BetterAuthRepository', error);
      throw error;
    }
  }

  async betterAuthFindManyUsers(
    where?: unknown,
    limit?: number,
    offset?: number,
    sortBy?: unknown,
  ): Promise<BetterAuthRecord[]> {
    try {
      const limitValue = typeof limit === 'number' && Number.isFinite(limit) ? limit : 100;
      const offsetValue = typeof offset === 'number' && Number.isFinite(offset) ? offset : 0;

      if (sortBy) {
        void sortBy; // reserved for future sorting logic
      }

      const conditions = where
        ? ensureWhereConditions(where, 'BetterAuthRepository.betterAuthFindManyUsers where')
        : [];

      const hasEmailAddressField = conditions.some(
        condition => condition.field === 'email_address',
      );

      let users: Array<unknown> = [];
      if (conditions.length === 0) {
        users = await this.sql`
          SELECT id, name, profile_picture as "image", email, phone_number, phone_number_verified, email_verified_date, two_factor_enabled,
                 role, user_type, created_date, updated_date
          FROM users
          ORDER BY created_date DESC
          LIMIT ${limitValue}
          OFFSET ${offsetValue}
        `;
      } else {
        const idCondition = conditions.find(condition => condition.field === 'id');
        const emailCondition = conditions.find(
          condition => condition.field === 'email' || condition.field === 'email_address',
        );
        const phoneCondition = conditions.find(condition => condition.field === 'phoneNumber');
        const nameCondition = conditions.find(condition => condition.field === 'name');

        if (idCondition?.operator === 'in' && idCondition.value !== undefined) {
          const ids = ensureStringArray(
            idCondition.value,
            'betterAuthFindManyUsers id condition values',
          );
          users = await this.sql`
            SELECT id, name, profile_picture as "image", email, phone_number, phone_number_verified, email_verified_date, two_factor_enabled,
                   role, user_type, created_date, updated_date
            FROM users
            WHERE id = ANY(${ids})
            ORDER BY created_date DESC
            LIMIT ${limitValue}
            OFFSET ${offsetValue}
          `;
        } else if (emailCondition?.value !== undefined) {
          const emailValue = emailCondition.value;
          if (emailCondition.operator === 'contains') {
            assertString(emailValue, 'betterAuthFindManyUsers email contains value');
            const searchTerm = `%${emailValue}%`;
            users = await this.sql`
              SELECT id, name, profile_picture as "image", email, phone_number, phone_number_verified, email_verified_date, two_factor_enabled,
                     role, user_type, created_date, updated_date
              FROM users
              WHERE email LIKE ${searchTerm}
              ORDER BY created_date DESC
              LIMIT ${limitValue}
              OFFSET ${offsetValue}
            `;
          } else {
            assertString(emailValue, 'betterAuthFindManyUsers email value');
            users = await this.sql`
              SELECT id, name, profile_picture as "image", email, phone_number, phone_number_verified, email_verified_date, two_factor_enabled,
                     role, user_type, created_date, updated_date
              FROM users
              WHERE email = ${emailValue}
              ORDER BY created_date DESC
              LIMIT ${limitValue}
              OFFSET ${offsetValue}
            `;
          }
        } else if (phoneCondition?.value !== undefined) {
          const phoneValue = phoneCondition.value;
          assertString(phoneValue, 'betterAuthFindManyUsers phone value');
          users = await this.sql`
            SELECT id, name, profile_picture as "image", email, phone_number, phone_number_verified, email_verified_date, two_factor_enabled,
                   role, user_type, created_date, updated_date
            FROM users
            WHERE phone_number = ${phoneValue} AND phone_number IS NOT NULL
            ORDER BY created_date DESC
            LIMIT ${limitValue}
            OFFSET ${offsetValue}
          `;
        } else if (nameCondition?.value !== undefined) {
          const nameValue = nameCondition.value;
          assertString(nameValue, 'betterAuthFindManyUsers name value');
          if (nameCondition.operator === 'contains') {
            const searchTerm = `%${nameValue}%`;
            users = await this.sql`
              SELECT id, name, profile_picture as "image", email, phone_number, phone_number_verified, email_verified_date, two_factor_enabled,
                     role, user_type, created_date, updated_date
              FROM users
              WHERE name LIKE ${searchTerm}
              ORDER BY created_date DESC
              LIMIT ${limitValue}
              OFFSET ${offsetValue}
            `;
          } else {
            users = await this.sql`
              SELECT id, name, profile_picture as "image", email, phone_number, phone_number_verified, email_verified_date, two_factor_enabled,
                     role, user_type, created_date, updated_date
              FROM users
              WHERE name = ${nameValue}
              ORDER BY created_date DESC
              LIMIT ${limitValue}
              OFFSET ${offsetValue}
            `;
          }
        } else {
          users = await this.sql`
            SELECT id, name, profile_picture as "image", email, phone_number, phone_number_verified, email_verified_date, two_factor_enabled,
                   role, user_type, created_date, updated_date
            FROM users
            ORDER BY created_date DESC
            LIMIT ${limitValue}
            OFFSET ${offsetValue}
          `;
        }
      }

      assertArrayMapOf(users, function (row) {
        assertDefined(row);
        alignBetterAuthUserData(row);
        return row as BetterAuthRecord;
      });

      if (hasEmailAddressField) {
        users.forEach(function (user) {
          assertDefined(user);
          assertPropDefined(user, 'email');
          setPropValue(user, 'email_address', user.email);
          alignBetterAuthUserData(user);
        });
      }

      return users as BetterAuthRecord[];
    } catch (error) {
      console.error('BetterAuthRepository', error);
      throw error;
    }
  }

  async betterAuthUpdateUser(where: unknown, update: unknown): Promise<BetterAuthRecord | null> {
    const tx = await this.beginTransaction();
    try {
      const conditions = ensureWhereConditions(
        where,
        'BetterAuthRepository.betterAuthUpdateUser where',
      );

      if (conditions.length === 0) {
        await tx.rollbackTransaction();
        return null;
      }

      const updates = ensureRecord(update, 'BetterAuthRepository.betterAuthUpdateUser update');

      const name = readOptionalString(updates, 'name');
      const email = readOptionalString(updates, 'email');
      const emailVerified = readOptionalBoolean(updates, 'emailVerified') ?? false;
      const phoneNumber = readOptionalString(updates, 'phoneNumber');
      const phoneNumberVerified = readOptionalBoolean(updates, 'phoneNumberVerified');
      const twoFactorEnabled = readOptionalBoolean(updates, 'twoFactorEnabled');
      const createdAtInput = readOptionalDateInput(updates, 'createdAt');
      const updatedAtInput = readOptionalDateInput(updates, 'updatedAt');
      const image = readOptionalStringOrNull(updates, 'image');

      const now = new Date();
      const createdAtUtc = normalizeDateInput(createdAtInput, now);
      const updatedAtUtc = normalizeDateInput(updatedAtInput, now);

      const idCondition = conditions.find(condition => condition.field === 'id');
      const emailCondition = conditions.find(
        condition => condition.field === 'email' || condition.field === 'email_address',
      );

      const idValue = idCondition?.value;
      if (idValue !== undefined) {
        assertStringOrNumber(idValue, 'betterAuthUpdateUser id value');
      }

      const emailConditionValue = emailCondition?.value;
      if (emailConditionValue !== undefined) {
        assertString(emailConditionValue, 'betterAuthUpdateUser email where value');
      }

      if (idValue === undefined && emailConditionValue === undefined) {
        console.warn('Update user requires id or email condition.');
        await tx.rollbackTransaction();
        return null;
      }

      const rows = await tx.sql`
        UPDATE users
        SET name = COALESCE(${name}, name),
          email = COALESCE(${email}, email),
          phone_number = COALESCE(${phoneNumber}, phone_number),
          phone_number_verified = COALESCE(${phoneNumberVerified}, phone_number_verified),
          two_factor_enabled = COALESCE(${twoFactorEnabled}, two_factor_enabled),
          email_verified_date = CASE
            WHEN email_verified_date IS NOT NULL THEN email_verified_date
            WHEN ${emailVerified ? 1 : 0} = 1 AND email_verified_date IS NULL THEN ${updatedAtUtc}
            WHEN ${emailVerified ? 1 : 0} = 0 THEN NULL
            ELSE email_verified_date
          END,
          profile_picture = COALESCE(${image}, profile_picture),
          created_date = COALESCE(${createdAtUtc}, created_date),
          updated_date = COALESCE(${updatedAtUtc}, updated_date)
        WHERE (${idValue !== undefined} AND id = ${idValue ?? null})
          OR (${emailConditionValue !== undefined} AND email = ${emailConditionValue ?? null})
        RETURNING id, name, profile_picture as "image", email, phone_number, phone_number_verified, email_verified_date,
          two_factor_enabled, role, user_type, created_date, updated_date
      `;

      assertArrayMapOf(rows, function (row) {
        assertDefined(row);
        alignBetterAuthUserData(row);
        return row as BetterAuthRecord;
      });

      const row = rows.length > 0 ? (rows[0] as BetterAuthRecord) : null;

      await tx.commitTransaction();

      return row;
    } catch (error) {
      console.error('BetterAuthRepository', error);
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async betterAuthUpdateManyUsers(where: unknown, update: unknown): Promise<BetterAuthRecord[]> {
    const tx = await this.beginTransaction();
    try {
      const conditions = ensureWhereConditions(
        where,
        'BetterAuthRepository.betterAuthUpdateManyUsers where',
      );

      if (conditions.length === 0) {
        await tx.rollbackTransaction();
        return [];
      }

      const updates = ensureRecord(update, 'BetterAuthRepository.betterAuthUpdateManyUsers update');

      const name = readOptionalString(updates, 'name');
      const email = readOptionalString(updates, 'email');
      const emailVerified = readOptionalBoolean(updates, 'emailVerified');
      const phoneNumber = readOptionalString(updates, 'phoneNumber');
      const phoneNumberVerified = readOptionalBoolean(updates, 'phoneNumberVerified');
      const createdAtInput = readOptionalDateInput(updates, 'createdAt');
      const updatedAtInput = readOptionalDateInput(updates, 'updatedAt');
      const image = readOptionalStringOrNull(updates, 'image');

      const now = new Date();
      const createdAtUtc = createdAtInput ? normalizeDateInput(createdAtInput, now) : null;
      const updatedAtUtc = updatedAtInput ? normalizeDateInput(updatedAtInput, now) : null;

      const idCondition = conditions.find(condition => condition.field === 'id');
      if (!idCondition) {
        console.warn('Update many users requires id condition.');
        await tx.rollbackTransaction();
        return [];
      }

      const emailCondition = conditions.find(
        condition => condition.field === 'email' || condition.field === 'email_address',
      );

      if (idCondition.value !== undefined) {
        assertStringOrNumber(idCondition.value, 'betterAuthUpdateManyUsers id value');
      }

      const emailConditionValue = emailCondition?.value;
      if (emailConditionValue !== undefined) {
        assertString(emailConditionValue, 'betterAuthUpdateManyUsers email value');
      }

      const emailVerifiedFlag = emailVerified ? 1 : 0;

      const rows = await tx.sql`
        UPDATE users
        SET name = COALESCE(${name}, name),
            email = COALESCE(${email}, email),
            phone_number = COALESCE(${phoneNumber}, phone_number),
            phone_number_verified = COALESCE(${phoneNumberVerified}, phone_number_verified),
            profile_picture = COALESCE(${image}, profile_picture),
            email_verified_date = CASE
              WHEN ${emailVerifiedFlag} = 1 AND email_verified_date IS NULL THEN ${updatedAtUtc}
              WHEN ${emailVerifiedFlag} = 0 THEN NULL
              ELSE email_verified_date
            END,
            created_date = COALESCE(${createdAtUtc}, created_date),
            updated_date = COALESCE(${updatedAtUtc}, updated_date)
        WHERE id = ${idCondition.value ?? null}
          OR email = ${emailConditionValue ?? null}
        RETURNING id, name, profile_picture as "image", email, phone_number, phone_number_verified, email_verified_date,
          two_factor_enabled, role, user_type, created_date, updated_date
      `;

      assertArrayMapOf(rows, function (row) {
        assertDefined(row);
        alignBetterAuthUserData(row);
        return row as BetterAuthRecord;
      });

      await tx.commitTransaction();

      return rows as BetterAuthRecord[];
    } catch (error) {
      console.error('BetterAuthRepository', error);
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async betterAuthDeleteUser(where: unknown): Promise<BetterAuthRecord | null> {
    const tx = await this.beginTransaction();
    try {
      const conditions = ensureWhereConditions(
        where,
        'BetterAuthRepository.betterAuthDeleteUser where',
      );

      if (conditions.length === 0) {
        await tx.rollbackTransaction();
        return null;
      }

      const idCondition = conditions.find(condition => condition.field === 'id');

      if (!idCondition) {
        console.warn('Delete user requires id condition.');
        await tx.rollbackTransaction();
        return null;
      }

      if (idCondition.value !== undefined) {
        assertStringOrNumber(idCondition.value, 'betterAuthDeleteUser id value');
      }

      const rows = await tx.sql`
          DELETE FROM users
          WHERE id = ${idCondition.value ?? null}
          RETURNING id, name, profile_picture as "image", email, email_verified_date,
                   created_date, updated_date
        `;

      assertArrayMapOf(rows, function (row) {
        assertDefined(row);
        alignBetterAuthUserData(row);
        return row as BetterAuthRecord;
      });

      const row = rows.length > 0 ? (rows[0] as BetterAuthRecord) : null;

      await tx.commitTransaction();

      return row;
    } catch (error) {
      console.error('BetterAuthRepository', error);
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async betterAuthDeleteManyUsers(where: unknown): Promise<BetterAuthRecord[]> {
    const tx = await this.beginTransaction();
    try {
      const conditions = ensureWhereConditions(
        where,
        'BetterAuthRepository.betterAuthDeleteManyUsers where',
      );

      if (conditions.length === 0) {
        await tx.rollbackTransaction();
        return [];
      }

      const idCondition = conditions.find(condition => condition.field === 'id');

      if (!idCondition) {
        console.warn('Delete many users requires id condition.');
        await tx.rollbackTransaction();
        return [];
      }

      if (idCondition.value !== undefined) {
        assertStringOrNumber(idCondition.value, 'betterAuthDeleteManyUsers id value');
      }

      const rows = await tx.sql`
          DELETE FROM users
          WHERE id = ${idCondition.value ?? null}
          RETURNING id, name, profile_picture as "image", email, email_verified_date,
            created_date, updated_date
        `;

      assertArrayMapOf(rows, function (row) {
        assertDefined(row);
        alignBetterAuthUserData(row);
        return row as BetterAuthRecord;
      });

      await tx.commitTransaction();

      return rows as BetterAuthRecord[];
    } catch (error) {
      console.error('BetterAuthRepository', error);
      await tx.rollbackTransaction();
      throw error;
    }
  }

  // Session methods for better-auth (using Redis)
  async betterAuthCreateSession(data: unknown): Promise<BetterAuthRecord> {
    try {
      const payload = ensureRecord(data, 'BetterAuthRepository.betterAuthCreateSession payload');

      assertPropString(payload, 'token', 'Session token must be a string');
      assertPropDefined(payload, 'userId', 'Session userId must be defined');

      const token = payload.token as string;
      const userIdValue = readOptionalStringOrNumber(payload, 'userId');
      assertDefined(userIdValue, 'Session userId must be a string or number');
      const userId = String(userIdValue);

      const sessionId = readOptionalString(payload, 'id') ?? v7();

      const createdAt = normalizeDateInput(readOptionalDateInput(payload, 'createdAt'), new Date());
      const updatedAt = normalizeDateInput(readOptionalDateInput(payload, 'updatedAt'), new Date());
      const expiresAtInput = readOptionalDateInput(payload, 'expiresAt');
      const expiresAt = expiresAtInput ? normalizeDateInput(expiresAtInput, updatedAt) : undefined;

      const session: BetterAuthRecord = {
        id: String(sessionId),
        token,
        userId,
        createdAt,
        updatedAt,
        ...(expiresAt ? { expiresAt } : {}),
      };

      const user = await this.betterAuthFindOneUser([
        { field: 'id', value: userId, operator: 'eq' },
      ]);

      let ttl: number | undefined;
      if (expiresAt) {
        const expiresAtMs = expiresAt.getTime();
        const nowMs = Date.now();
        const diffSeconds = Math.floor((expiresAtMs - nowMs) / 1000);
        if (Number.isFinite(diffSeconds)) {
          ttl = Math.max(1, diffSeconds);
        }
      }

      const sessionWithUser = {
        session,
        user,
      };
      await this.set(token, JSON.stringify(sessionWithUser), ttl);

      await this.set(`session:token:${token}`, sessionId, ttl);
      await this.set(`session:userId:${userId}`, sessionId, ttl);
      await this.set(`session:${sessionId}`, session, ttl);

      return session;
    } catch (error) {
      console.error('BetterAuthRepository', error);
      throw error;
    }
  }

  async betterAuthFindOneSession(where: unknown): Promise<BetterAuthRecord | null> {
    try {
      const conditions = ensureWhereConditions(
        where,
        'BetterAuthRepository.betterAuthFindOneSession where',
      );

      if (conditions.length === 0) {
        return null;
      }

      for (const condition of conditions) {
        const value = condition.value;
        if (value === undefined) {
          continue;
        }

        if (condition.field === 'token') {
          if (!isString(value)) {
            continue;
          }
          const sessionIdValue = await this.get(`session:token:${value}`);
          let sessionId: string | undefined;
          if (isString(sessionIdValue) || isNumber(sessionIdValue)) {
            sessionId = String(sessionIdValue);
          }
          if (!sessionId) {
            continue;
          }
          const sessionValue = await this.get(`session:${sessionId}`);
          const sessionRecord = readOptionalRecord(
            sessionValue,
            'BetterAuthRepository.betterAuthFindOneSession session record',
          );
          if (sessionRecord) {
            assertPropString(sessionRecord, 'id', 'Session record must include id');
            return sessionRecord;
          }
        } else if (condition.field === 'id') {
          if (!isString(value) && !isNumber(value)) {
            continue;
          }
          const sessionValue = await this.get(`session:${String(value)}`);
          const sessionRecord = readOptionalRecord(
            sessionValue,
            'BetterAuthRepository.betterAuthFindOneSession session by id',
          );
          if (sessionRecord) {
            assertPropString(sessionRecord, 'id', 'Session record must include id');
            return sessionRecord;
          }
        } else if (condition.field === 'userId') {
          if (!isString(value) && !isNumber(value)) {
            continue;
          }
          const sessionIdValue = await this.get(`session:userId:${String(value)}`);
          let sessionId: string | undefined;
          if (isString(sessionIdValue) || isNumber(sessionIdValue)) {
            sessionId = String(sessionIdValue);
          }
          if (!sessionId) {
            continue;
          }
          const sessionValue = await this.get(`session:${sessionId}`);
          const sessionRecord = readOptionalRecord(
            sessionValue,
            'BetterAuthRepository.betterAuthFindOneSession session by userId',
          );
          if (sessionRecord) {
            assertPropString(sessionRecord, 'id', 'Session record must include id');
            return sessionRecord;
          }
        }
      }

      return null;
    } catch (error) {
      console.error('BetterAuthRepository:betterAuthFindOneSession error:', error);
      throw error;
    }
  }

  async betterAuthUpdateSession(where: unknown, update: unknown): Promise<BetterAuthRecord | null> {
    const conditions = ensureWhereConditions(
      where,
      'BetterAuthRepository.betterAuthUpdateSession where',
    );

    if (conditions.length === 0) {
      return null;
    }

    const session = await this.betterAuthFindOneSession(conditions);
    if (!session) {
      return null;
    }

    const updates = ensureRecord(update, 'BetterAuthRepository.betterAuthUpdateSession update');

    const updatedSession: BetterAuthRecord = { ...session };

    for (const [key, value] of Object.entries(updates)) {
      updatedSession[key] = value;
    }

    updatedSession.updatedAt = new Date();

    let ttl: number | undefined;
    const expiresAtInput = readOptionalDateInput(updatedSession, 'expiresAt');
    if (expiresAtInput !== undefined) {
      const expiresAtDate = normalizeDateInput(expiresAtInput, new Date());
      updatedSession.expiresAt = expiresAtDate;
      const diffSeconds = Math.floor((expiresAtDate.getTime() - Date.now()) / 1000);
      if (Number.isFinite(diffSeconds)) {
        ttl = Math.max(1, diffSeconds);
      }
    }

    const sessionIdValue = readOptionalStringOrNumber(updatedSession, 'id');
    assertDefined(sessionIdValue, 'Updated session must contain id');
    const sessionId = String(sessionIdValue);

    const sessionToken =
      readOptionalString(updatedSession, 'token') ?? readOptionalString(session, 'token');

    await this.set(`session:${sessionId}`, updatedSession, ttl);
    if (sessionToken) {
      await this.set(`session:token:${sessionToken}`, sessionId, ttl);
    }

    return updatedSession;
  }

  async betterAuthDeleteSession(where: unknown): Promise<BetterAuthRecord | null> {
    try {
      const conditions = ensureWhereConditions(
        where,
        'BetterAuthRepository.betterAuthDeleteSession where',
      );

      if (conditions.length === 0) {
        return null;
      }

      const session = await this.betterAuthFindOneSession(conditions);
      if (!session) {
        return null;
      }

      const sessionIdValue = readOptionalStringOrNumber(session, 'id');
      assertDefined(sessionIdValue, 'Session to delete must contain id');
      const sessionId = String(sessionIdValue);

      const sessionToken = readOptionalString(session, 'token');

      await this.del(`session:${sessionId}`);
      if (sessionToken) {
        await this.del(`session:token:${sessionToken}`);
      }

      return session;
    } catch (error) {
      console.error('BetterAuthRepository', error);
      throw error;
    }
  }

  async betterAuthDeleteManySession(where: unknown): Promise<BetterAuthRecord[]> {
    const session = await this.betterAuthFindOneSession(where);
    if (session) {
      await this.betterAuthDeleteSession(where);
      return [session];
    }
    return [];
  }

  // Account methods for better-auth (stored in auth_providers table)
  async betterAuthCreateAccount(data: unknown): Promise<BetterAuthRecord> {
    const tx = await this.beginTransaction();
    try {
      const payload = ensureRecord(data, 'BetterAuthRepository.betterAuthCreateAccount payload');

      const accountRecordId = readOptionalString(payload, 'id') ?? v7();

      const userIdValue = readOptionalStringOrNumber(payload, 'userId');
      assertDefined(userIdValue, 'Account userId must be provided');
      const accountIdValue = readOptionalStringOrNumber(payload, 'accountId');
      assertDefined(accountIdValue, 'Account accountId must be provided');
      const providerIdValue = readOptionalStringOrNumber(payload, 'providerId');
      assertDefined(providerIdValue, 'Account providerId must be provided');

      const accessToken = readOptionalString(payload, 'accessToken');
      const refreshToken = readOptionalString(payload, 'refreshToken');
      const password = readOptionalString(payload, 'password');

      const createdDate = normalizeDateInput(
        readOptionalDateInput(payload, 'createdAt'),
        new Date(),
      );
      const updatedDate = normalizeDateInput(
        readOptionalDateInput(payload, 'updatedAt'),
        createdDate,
      );
      const expiresAtInput = readOptionalDateInput(payload, 'expiresAt');
      const accessTokenExpiresDate = expiresAtInput
        ? normalizeDateInput(expiresAtInput, updatedDate)
        : null;

      const rows = await tx.sql`
      INSERT INTO auth_providers (
        id, account_id, provider_id, user_id, access_token, refresh_token, password,
        access_token_expires_date, created_date, updated_date
      ) VALUES (
        ${String(accountRecordId)}, ${String(accountIdValue)}, ${String(providerIdValue)}, ${String(userIdValue)}, ${accessToken}, ${refreshToken}, ${password},
        ${accessTokenExpiresDate}, ${createdDate}, ${updatedDate}
      ) RETURNING id, account_id, provider_id, user_id, access_token, refresh_token, password, access_token_expires_date, created_date, updated_date;
    `;

      const row = rows[0];
      if (!row) {
        throw new Error('Failed to create account record');
      }

      assertDefined(row);
      assertProp(check(isString, isNumber), row, 'id');
      assertProp(check(isString, isNumber), row, 'user_id');
      assertProp(check(isString, isNumber), row, 'account_id');
      assertProp(check(isString, isNumber), row, 'provider_id');
      assertPropNullableString(row, 'access_token');
      assertPropNullableString(row, 'refresh_token');
      assertPropNullableString(row, 'password');

      await tx.commitTransaction();

      const account: BetterAuthRecord = {
        id: String(row.id),
        userId: row.user_id ? String(row.user_id) : undefined,
        accountId: row.account_id,
        providerId: row.provider_id,
        accessToken: row.access_token,
        refreshToken: row.refresh_token,
        password: row.password,
      };

      if ('access_token_expires_date' in row && row.access_token_expires_date instanceof Date) {
        account.expiresAt = row.access_token_expires_date;
      }
      if ('created_date' in row && row.created_date instanceof Date) {
        account.createdAt = row.created_date;
      }
      if ('updated_date' in row && row.updated_date instanceof Date) {
        account.updatedAt = row.updated_date;
      }

      return account;
    } catch (error) {
      console.error('BetterAuthRepository', error);
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async betterAuthFindOneAccount(where: unknown): Promise<BetterAuthRecord | null> {
    try {
      const conditions = ensureWhereConditions(
        where,
        'BetterAuthRepository.betterAuthFindOneAccount where',
      );

      if (conditions.length === 0) return null;

      const userIdCondition = conditions.find(condition => condition.field === 'userId');
      const providerIdCondition = conditions.find(condition => condition.field === 'providerId');
      const accountIdCondition = conditions.find(condition => condition.field === 'accountId');
      const idCondition = conditions.find(condition => condition.field === 'id');

      const mapRowToAccount = function (row: unknown): BetterAuthRecord {
        assertDefined(row);
        assertProp(check(isString, isNumber), row, 'id');
        assertProp(check(isString, isNumber), row, 'user_id');
        assertProp(check(isString, isNumber), row, 'account_id');
        assertProp(check(isString, isNumber), row, 'provider_id');
        assertPropNullableString(row, 'access_token');
        assertPropNullableString(row, 'refresh_token');
        assertPropNullableString(row, 'password');

        const account: BetterAuthRecord = {
          id: String(row.id),
          userId: row.user_id ? String(row.user_id) : undefined,
          accountId: row.account_id,
          providerId: row.provider_id,
          accessToken: row.access_token,
          refreshToken: row.refresh_token,
          password: row.password,
        };

        if ('access_token_expires_date' in row && row.access_token_expires_date instanceof Date) {
          account.expiresAt = row.access_token_expires_date.toISOString();
        }
        if ('created_date' in row && row.created_date instanceof Date) {
          account.createdAt = row.created_date.toISOString();
        }
        if ('updated_date' in row && row.updated_date instanceof Date) {
          account.updatedAt = row.updated_date.toISOString();
        }

        return account;
      };

      if (idCondition?.value !== undefined) {
        assertStringOrNumber(idCondition.value, 'betterAuthFindOneAccount id value');
        const rows = await this.sql`
        SELECT id, account_id, provider_id, user_id, access_token, refresh_token, password, access_token_expires_date, created_date, updated_date
        FROM auth_providers WHERE id = ${String(idCondition.value)} LIMIT 1
      `;
        const row = rows[0];
        if (row) return mapRowToAccount(row);
      }

      if (accountIdCondition?.value !== undefined && providerIdCondition?.value !== undefined) {
        assertStringOrNumber(accountIdCondition.value, 'betterAuthFindOneAccount accountId value');
        assertStringOrNumber(
          providerIdCondition.value,
          'betterAuthFindOneAccount providerId value',
        );
        const rows = await this.sql`
        SELECT id, account_id, provider_id, user_id, access_token, refresh_token, password, access_token_expires_date, created_date, updated_date
        FROM auth_providers WHERE account_id = ${String(accountIdCondition.value)} AND provider_id = ${String(providerIdCondition.value)} LIMIT 1
      `;
        const row = rows[0];
        if (row) return mapRowToAccount(row);
      }

      if (userIdCondition?.value !== undefined && providerIdCondition?.value !== undefined) {
        assertStringOrNumber(userIdCondition.value, 'betterAuthFindOneAccount userId value');
        assertStringOrNumber(
          providerIdCondition.value,
          'betterAuthFindOneAccount providerId value',
        );
        const rows = await this.sql`
        SELECT id, account_id, provider_id, user_id, access_token, refresh_token, password, access_token_expires_date, created_date, updated_date
        FROM auth_providers WHERE user_id = ${String(userIdCondition.value)} AND provider_id = ${String(providerIdCondition.value)} LIMIT 1
      `;
        const row = rows[0];
        if (row) return mapRowToAccount(row);
      }

      if (userIdCondition?.value !== undefined && providerIdCondition?.value === undefined) {
        assertStringOrNumber(userIdCondition.value, 'betterAuthFindOneAccount userId value');
        const rows = await this.sql`
        SELECT id, account_id, provider_id, user_id, access_token, refresh_token, password, access_token_expires_date, created_date, updated_date
        FROM auth_providers WHERE user_id = ${String(userIdCondition.value)} AND provider_id = 'credential' LIMIT 1
      `;
        let row = rows[0];
        if (!row) {
          const fallbackRows = await this.sql`
          SELECT id, account_id, provider_id, user_id, access_token, refresh_token, password, access_token_expires_date, created_date, updated_date
          FROM auth_providers WHERE user_id = ${String(userIdCondition.value)} LIMIT 1
        `;
          row = fallbackRows[0];
        }
        if (row) return mapRowToAccount(row);
      }

      return null;
    } catch (error) {
      console.error('BetterAuthRepository', error);
      throw error;
    }
  }

  async betterAuthFindManyAccounts(
    where?: unknown,
    limit?: number,
    offset?: number,
    sortBy?: unknown,
  ): Promise<BetterAuthRecord[]> {
    try {
      void limit;
      void offset;
      void sortBy;

      const conditions = ensureWhereConditions(
        where,
        'BetterAuthRepository.betterAuthFindManyAccounts where',
      );

      if (conditions.length === 0) {
        return [];
      }

      const account = await this.betterAuthFindOneAccount(conditions);
      return account ? [account] : [];
    } catch (error) {
      console.error('BetterAuthRepository', error);
      throw error;
    }
  }

  async betterAuthUpdateAccount(where: unknown, update: unknown): Promise<BetterAuthRecord | null> {
    const conditions = ensureWhereConditions(
      where,
      'BetterAuthRepository.betterAuthUpdateAccount where',
    );

    if (conditions.length === 0) {
      return null;
    }

    const account = await this.betterAuthFindOneAccount(conditions);
    if (!account) return null;

    const updates = ensureRecord(update, 'BetterAuthRepository.betterAuthUpdateAccount update');

    const accountIdValue = readOptionalStringOrNumber(updates, 'accountId');
    const providerIdValue = readOptionalStringOrNumber(updates, 'providerId');
    const userIdValue = readOptionalStringOrNumber(updates, 'userId');
    const accessToken = readOptionalString(updates, 'accessToken');
    const refreshToken = readOptionalString(updates, 'refreshToken');
    const password = readOptionalString(updates, 'password');
    const expiresAtInput = readOptionalDateInput(updates, 'expiresAt');
    const accessTokenExpiresUtc = expiresAtInput
      ? normalizeDateInput(expiresAtInput, new Date())
      : null;

    const updatedAtUtc = new Date();

    const accountId = readOptionalStringOrNumber(account, 'id');
    assertDefined(accountId, 'Existing account must include id');

    const tx = await this.beginTransaction();
    try {
      const rows = await tx.sql`
      UPDATE auth_providers SET
        account_id = COALESCE(${accountIdValue !== undefined ? String(accountIdValue) : null}, account_id),
        provider_id = COALESCE(${providerIdValue !== undefined ? String(providerIdValue) : null}, provider_id),
        user_id = COALESCE(${userIdValue !== undefined ? String(userIdValue) : null}, user_id),
        access_token = COALESCE(${accessToken}, access_token),
        refresh_token = COALESCE(${refreshToken}, refresh_token),
        password = COALESCE(${password}, password),
        access_token_expires_date = COALESCE(${accessTokenExpiresUtc}, access_token_expires_date),
        updated_date = ${updatedAtUtc}
      WHERE id = ${String(accountId)}
      RETURNING id, account_id, provider_id, user_id, access_token, refresh_token, password, access_token_expires_date, created_date, updated_date;
    `;

      const row = rows[0];
      if (!row) {
        await tx.commitTransaction();
        return null;
      }

      assertDefined(row);
      assertProp(check(isString, isNumber), row, 'id');
      assertProp(check(isString, isNumber), row, 'user_id');
      assertProp(check(isString, isNumber), row, 'account_id');
      assertProp(check(isString, isNumber), row, 'provider_id');
      assertPropNullableString(row, 'access_token');
      assertPropNullableString(row, 'refresh_token');
      assertPropNullableString(row, 'password');

      await tx.commitTransaction();

      const updatedAccount: BetterAuthRecord = {
        id: String(row.id),
        userId: row.user_id ? String(row.user_id) : undefined,
        accountId: row.account_id,
        providerId: row.provider_id,
        accessToken: row.access_token,
        refreshToken: row.refresh_token,
        password: row.password,
      };

      if ('access_token_expires_date' in row && row.access_token_expires_date instanceof Date) {
        updatedAccount.expiresAt = row.access_token_expires_date;
      }
      if ('created_date' in row && row.created_date instanceof Date) {
        updatedAccount.createdAt = row.created_date;
      }
      if ('updated_date' in row && row.updated_date instanceof Date) {
        updatedAccount.updatedAt = row.updated_date;
      }

      return updatedAccount;
    } catch (error) {
      console.error('BetterAuthRepository', error);
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async betterAuthUpdateManyAccounts(where: unknown, update: unknown): Promise<BetterAuthRecord[]> {
    const account = await this.betterAuthUpdateAccount(where, update);
    return account ? [account] : [];
  }

  async betterAuthDeleteAccount(where: unknown): Promise<BetterAuthRecord | null> {
    const conditions = ensureWhereConditions(
      where,
      'BetterAuthRepository.betterAuthDeleteAccount where',
    );
    if (conditions.length === 0) return null;

    const account = await this.betterAuthFindOneAccount(conditions);
    if (!account) return null;

    const accountIdValue = readOptionalStringOrNumber(account, 'id');
    assertDefined(accountIdValue, 'Account deletion requires account id');

    const tx = await this.beginTransaction();
    try {
      await tx.sql`DELETE FROM auth_providers WHERE id = ${String(accountIdValue)}`;
      await tx.commitTransaction();
      return account;
    } catch (error) {
      console.error('BetterAuthRepository', error);
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async betterAuthDeleteManyAccounts(where: unknown): Promise<BetterAuthRecord[]> {
    const account = await this.betterAuthDeleteAccount(where);
    return account ? [account] : [];
  }

  async betterAuthCreateVerification(data: unknown): Promise<BetterAuthRecord> {
    try {
      const payload = ensureRecord(
        data,
        'BetterAuthRepository.betterAuthCreateVerification payload',
      );

      const verificationId = readOptionalString(payload, 'id') ?? v7();
      const identifier = readOptionalString(payload, 'identifier');
      assertDefined(identifier, 'Verification identifier must be provided');

      const value = readOptionalString(payload, 'value');

      const createdAt = normalizeDateInput(readOptionalDateInput(payload, 'createdAt'), new Date());
      const updatedAt = normalizeDateInput(readOptionalDateInput(payload, 'updatedAt'), createdAt);
      const expiresAtInput = readOptionalDateInput(payload, 'expiresAt');
      const expiresAt = expiresAtInput ? normalizeDateInput(expiresAtInput, updatedAt) : undefined;

      const verification: BetterAuthRecord = {
        id: verificationId,
        identifier,
        value,
        createdAt,
        updatedAt,
      };

      if (expiresAt) {
        verification.expiresAt = expiresAt;
      }

      let ttl = 3600;
      if (expiresAt) {
        const diffSeconds = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
        if (Number.isFinite(diffSeconds)) {
          ttl = Math.max(1, diffSeconds);
        }
      }

      await this.set(`verification:${verificationId}`, verification, ttl);

      if (value) {
        await this.set(`verification:value:${value}`, verificationId, ttl);
      }

      const listKey = `verification:list:${identifier}`;
      const existingList = ensureOptionalStringArray(
        await this.get(listKey),
        'BetterAuthRepository.betterAuthCreateVerification list',
      );
      existingList.push(verificationId);
      await this.set(listKey, existingList, ttl);

      return verification;
    } catch (error) {
      console.error('BetterAuthRepository', error);
      throw error;
    }
  }

  async betterAuthFindOneVerification(where: unknown): Promise<BetterAuthRecord | null> {
    try {
      const conditions = ensureWhereConditions(
        where,
        'BetterAuthRepository.betterAuthFindOneVerification where',
      );

      if (conditions.length === 0) {
        return null;
      }

      for (const condition of conditions) {
        const value = condition.value;
        if (value === undefined) {
          continue;
        }

        if (condition.field === 'identifier') {
          assertString(value, 'Verification identifier must be a string');
          const listKey = `verification:list:${value}`;
          const verificationIds = ensureOptionalStringArray(
            await this.get(listKey),
            'BetterAuthRepository.betterAuthFindOneVerification id list',
          );

          const verifications: BetterAuthRecord[] = [];
          for (const verificationId of verificationIds) {
            const verification = readOptionalRecord(
              await this.get(`verification:${verificationId}`),
              'BetterAuthRepository.betterAuthFindOneVerification verification item',
            );
            if (verification) {
              verifications.push(verification);
            }
          }

          if (verifications.length > 0) {
            verifications.sort(function (a, b) {
              const aCreated = tryToDate(a.createdAt) ?? new Date(0);
              const bCreated = tryToDate(b.createdAt) ?? new Date(0);
              return bCreated.getTime() - aCreated.getTime();
            });
            return verifications[0];
          }
        } else if (condition.field === 'id') {
          assertStringOrNumber(value, 'Verification id must be string or number');
          const verification = readOptionalRecord(
            await this.get(`verification:${String(value)}`),
            'BetterAuthRepository.betterAuthFindOneVerification by id',
          );
          if (verification) {
            return verification;
          }
        } else if (condition.field === 'value' || condition.field === 'token') {
          if (!isString(value)) {
            continue;
          }
          const mappedId = await this.get(`verification:value:${value}`);
          if (isString(mappedId) || isNumber(mappedId)) {
            const verification = readOptionalRecord(
              await this.get(`verification:${String(mappedId)}`),
              'BetterAuthRepository.betterAuthFindOneVerification by mapped id',
            );
            if (verification) {
              return verification;
            }
          }

          const direct = readOptionalRecord(
            await this.get(`verification:value:${value}`),
            'BetterAuthRepository.betterAuthFindOneVerification direct',
          );
          if (direct) {
            return direct;
          }
        }
      }

      return null;
    } catch (error) {
      console.error('BetterAuthRepository', error);
      throw error;
    }
  }

  async betterAuthFindManyVerifications(
    where?: unknown,
    limit?: number,
    offset?: number,
    sortBy?: unknown,
  ): Promise<BetterAuthRecord[]> {
    try {
      const conditions = ensureWhereConditions(
        where,
        'BetterAuthRepository.betterAuthFindManyVerifications where',
      );

      if (conditions.length === 0) {
        return [];
      }

      // Find by identifier and return array
      const identifierCondition = conditions.find(condition => condition.field === 'identifier');
      if (identifierCondition?.value !== undefined) {
        assertString(identifierCondition.value, 'Verification identifier must be string');
        const listKey = `verification:list:${identifierCondition.value}`;
        const verificationIds = ensureOptionalStringArray(
          await this.get(listKey),
          'BetterAuthRepository.betterAuthFindManyVerifications list',
        );

        const verifications: BetterAuthRecord[] = [];
        for (const verificationId of verificationIds) {
          const verification = readOptionalRecord(
            await this.get(`verification:${verificationId}`),
            'BetterAuthRepository.betterAuthFindManyVerifications item',
          );
          if (verification) {
            verifications.push(verification);
          }
        }

        let sortField: string | undefined;
        let sortDirection: string | undefined;
        if (sortBy !== undefined) {
          try {
            const sortRecord = ensureRecord(
              sortBy,
              'BetterAuthRepository.betterAuthFindManyVerifications sortBy',
            );
            sortField = readOptionalString(sortRecord, 'field');
            sortDirection = readOptionalString(sortRecord, 'direction');
          } catch (sortError) {
            console.warn('Invalid sortBy provided for verifications', sortError);
          }
        }

        if (sortField === 'createdAt' && sortDirection === 'desc') {
          verifications.sort(function (a, b) {
            const aCreated = tryToDate(a.createdAt) ?? new Date(0);
            const bCreated = tryToDate(b.createdAt) ?? new Date(0);
            return bCreated.getTime() - aCreated.getTime();
          });
        }

        if (limit && limit > 0) {
          return verifications.slice(0, limit);
        }

        return verifications;
      }

      return [];
    } catch (error) {
      console.error('BetterAuthRepository', error);
      throw error;
    }
  }

  async betterAuthUpdateVerification(
    where: unknown,
    update: unknown,
  ): Promise<BetterAuthRecord | null> {
    const conditions = ensureWhereConditions(
      where,
      'BetterAuthRepository.betterAuthUpdateVerification where',
    );
    if (conditions.length === 0) {
      return null;
    }

    const verification = await this.betterAuthFindOneVerification(conditions);
    if (!verification) {
      return null;
    }

    try {
      const updates = ensureRecord(
        update,
        'BetterAuthRepository.betterAuthUpdateVerification update',
      );

      const updatedVerification: BetterAuthRecord = { ...verification };
      for (const [key, value] of Object.entries(updates)) {
        updatedVerification[key] = value;
      }
      updatedVerification.updatedAt = new Date();

      let ttl = 3600;
      const expiresAtInput = readOptionalDateInput(updatedVerification, 'expiresAt');
      if (expiresAtInput !== undefined) {
        const expiresAtDate = normalizeDateInput(expiresAtInput, new Date());
        updatedVerification.expiresAt = expiresAtDate;
        const diffSeconds = Math.floor((expiresAtDate.getTime() - Date.now()) / 1000);
        if (Number.isFinite(diffSeconds)) {
          ttl = Math.max(1, diffSeconds);
        }
      }

      const verificationId = readOptionalStringOrNumber(verification, 'id');
      assertDefined(verificationId, 'Verification update requires id');

      await this.set(`verification:${String(verificationId)}`, updatedVerification, ttl);

      const identifier = readOptionalString(verification, 'identifier');
      if (identifier) {
        const listKey = `verification:list:${identifier}`;
        const currentList = ensureOptionalStringArray(
          await this.get(listKey),
          'BetterAuthRepository.betterAuthUpdateVerification list',
        );
        await this.set(listKey, currentList, ttl);
      }

      const previousValue = readOptionalString(verification, 'value');
      const nextValue = readOptionalString(updatedVerification, 'value');
      if (previousValue && previousValue !== nextValue) {
        await this.del(`verification:value:${previousValue}`);
      }
      if (nextValue) {
        await this.set(`verification:value:${nextValue}`, verificationId, ttl);
      }

      return updatedVerification;
    } catch (error) {
      console.error('BetterAuthRepository', error);
      throw error;
    }
  }

  async betterAuthDeleteVerification(where: unknown): Promise<BetterAuthRecord | null> {
    const conditions = ensureWhereConditions(
      where,
      'BetterAuthRepository.betterAuthDeleteVerification where',
    );
    if (conditions.length === 0) {
      return null;
    }

    const verification = await this.betterAuthFindOneVerification(conditions);
    if (!verification) {
      return null;
    }

    try {
      const verificationIdValue = readOptionalStringOrNumber(verification, 'id');
      assertDefined(verificationIdValue, 'Verification deletion requires id');
      const verificationId = String(verificationIdValue);

      await this.del(`verification:${verificationId}`);

      const identifier = readOptionalString(verification, 'identifier');
      if (identifier) {
        const listKey = `verification:list:${identifier}`;
        const verificationIds = ensureOptionalStringArray(
          await this.get(listKey),
          'BetterAuthRepository.betterAuthDeleteVerification list',
        );
        const updatedIds = verificationIds.filter(id => id !== verificationId);
        if (updatedIds.length > 0) {
          await this.set(listKey, updatedIds);
        } else {
          await this.del(listKey);
        }
      }

      const value = readOptionalString(verification, 'value');
      if (value) {
        await this.del(`verification:value:${value}`);
      }

      return verification;
    } catch (error) {
      console.error('BetterAuthRepository', error);
      throw error;
    }
  }

  async betterAuthDeleteManyVerifications(where: unknown): Promise<BetterAuthRecord[]> {
    const conditions = ensureWhereConditions(
      where,
      'BetterAuthRepository.betterAuthDeleteManyVerifications where',
    );

    if (conditions.length === 0) {
      return [];
    }

    const expiresAtCondition = conditions.find(
      condition => condition.field === 'expiresAt' && condition.operator === 'lt',
    );
    if (expiresAtCondition) {
      // Simplified cleanup: rely on natural expiration as per original implementation
      return [];
    }

    const verification = await this.betterAuthDeleteVerification(conditions);
    return verification ? [verification] : [];
  }

  // TwoFactor methods for better-auth two-factor plugin
  async betterAuthCreateTwoFactor(data: unknown): Promise<BetterAuthRecord> {
    const tx = await this.beginTransaction();
    try {
      const payload = ensureRecord(data, 'BetterAuthRepository.betterAuthCreateTwoFactor payload');

      const twoFactorId = readOptionalString(payload, 'id') ?? v7();
      const secret = readOptionalString(payload, 'secret');
      assertDefined(secret, 'Two-factor secret must be provided');
      const backupCodes = readOptionalString(payload, 'backupCodes');
      assertDefined(backupCodes, 'Two-factor backup codes must be provided');
      const userIdValue = readOptionalStringOrNumber(payload, 'userId');
      assertDefined(userIdValue, 'Two-factor userId must be provided');

      const rows = await tx.sql`
        INSERT INTO two_factor (id, secret, backup_codes, user_id)
        VALUES (${String(twoFactorId)}, ${secret}, ${backupCodes}, ${String(userIdValue)})
        RETURNING id, secret, backup_codes as "backupCodes", user_id as "userId"
      `;

      const row = rows[0];
      if (!row) {
        throw new Error('Failed to create two-factor record');
      }

      assertDefined(row);
      assertProp(check(isString, isNumber), row, 'id');
      assertPropString(row, 'secret');
      assertPropString(row, 'backupCodes');
      assertProp(check(isString, isNumber), row, 'userId');

      await tx.commitTransaction();

      const result: BetterAuthRecord = {
        id: String(row.id),
        secret: row.secret,
        backupCodes: row.backupCodes,
        userId: String(row.userId),
      };

      return result;
    } catch (error) {
      console.error('BetterAuthRepository:betterAuthCreateTwoFactor', error);
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async betterAuthFindOneTwoFactor(where: unknown): Promise<BetterAuthRecord | null> {
    try {
      const conditions = ensureWhereConditions(
        where,
        'BetterAuthRepository.betterAuthFindOneTwoFactor where',
      );

      if (conditions.length === 0) {
        return null;
      }

      const userIdCondition = conditions.find(condition => condition.field === 'userId');
      const idCondition = conditions.find(condition => condition.field === 'id');

      let rows: Array<unknown> = [];
      if (idCondition?.value !== undefined) {
        assertStringOrNumber(idCondition.value, 'Two-factor id must be string or number');
        rows = await this.sql`
          SELECT id, secret, backup_codes as "backupCodes", user_id as "userId"
          FROM two_factor
          WHERE id = ${String(idCondition.value)}
        `;
      } else if (userIdCondition?.value !== undefined) {
        assertStringOrNumber(userIdCondition.value, 'Two-factor userId must be string or number');
        rows = await this.sql`
          SELECT id, secret, backup_codes as "backupCodes", user_id as "userId"
          FROM two_factor
          WHERE user_id = ${String(userIdCondition.value)}
        `;
      } else {
        return null;
      }

      if (rows.length === 0) return null;

      const row = rows[0];
      assertDefined(row);
      assertProp(check(isString, isNumber), row, 'id');
      assertPropString(row, 'secret');
      assertPropString(row, 'backupCodes');
      assertProp(check(isString, isNumber), row, 'userId');

      const result: BetterAuthRecord = {
        id: String(row.id),
        secret: row.secret,
        backupCodes: row.backupCodes,
        userId: String(row.userId),
      };

      return result;
    } catch (error) {
      console.error('BetterAuthRepository:betterAuthFindOneTwoFactor', error);
      throw error;
    }
  }

  async betterAuthFindManyTwoFactor(
    where?: unknown,
    limit?: number,
    offset?: number,
    sortBy?: unknown,
  ): Promise<BetterAuthRecord[]> {
    try {
      void sortBy;

      const limitValue = typeof limit === 'number' && Number.isFinite(limit) ? limit : 100;
      const offsetValue = typeof offset === 'number' && Number.isFinite(offset) ? offset : 0;

      const conditions = ensureWhereConditions(
        where,
        'BetterAuthRepository.betterAuthFindManyTwoFactor where',
      );

      if (conditions.length === 0) {
        const rows = await this.sql`
          SELECT id, secret, backup_codes as "backupCodes", user_id as "userId"
          FROM two_factor
          LIMIT ${limitValue}
          OFFSET ${offsetValue}
        `;

        return rows.map(row => {
          assertDefined(row);
          assertProp(check(isString, isNumber), row, 'id');
          assertPropString(row, 'secret');
          assertPropString(row, 'backupCodes');
          assertProp(check(isString, isNumber), row, 'userId');

          return {
            id: String(row.id),
            secret: row.secret,
            backupCodes: row.backupCodes,
            userId: String(row.userId),
          } as BetterAuthRecord;
        });
      }

      const twoFactor = await this.betterAuthFindOneTwoFactor(conditions);
      return twoFactor ? [twoFactor] : [];
    } catch (error) {
      console.error('BetterAuthRepository:betterAuthFindManyTwoFactor', error);
      throw error;
    }
  }

  async betterAuthUpdateTwoFactor(
    where: unknown,
    update: unknown,
  ): Promise<BetterAuthRecord | null> {
    const tx = await this.beginTransaction();
    try {
      const conditions = ensureWhereConditions(
        where,
        'BetterAuthRepository.betterAuthUpdateTwoFactor where',
      );
      if (conditions.length === 0) {
        await tx.rollbackTransaction();
        return null;
      }

      const updates = ensureRecord(update, 'BetterAuthRepository.betterAuthUpdateTwoFactor update');
      const secret = readOptionalString(updates, 'secret');
      const backupCodes = readOptionalString(updates, 'backupCodes');

      const userIdCondition = conditions.find(condition => condition.field === 'userId');
      const idCondition = conditions.find(condition => condition.field === 'id');

      let rows: Array<unknown> = [];
      if (idCondition?.value !== undefined) {
        assertStringOrNumber(idCondition.value, 'Two-factor id must be string or number');
        rows = await tx.sql`
          UPDATE two_factor
          SET secret = COALESCE(${secret}, secret),
              backup_codes = COALESCE(${backupCodes}, backup_codes)
          WHERE id = ${String(idCondition.value)}
          RETURNING id, secret, backup_codes as "backupCodes", user_id as "userId"
        `;
      } else if (userIdCondition?.value !== undefined) {
        assertStringOrNumber(userIdCondition.value, 'Two-factor userId must be string or number');
        rows = await tx.sql`
          UPDATE two_factor
          SET secret = COALESCE(${secret}, secret),
              backup_codes = COALESCE(${backupCodes}, backup_codes)
          WHERE user_id = ${String(userIdCondition.value)}
          RETURNING id, secret, backup_codes as "backupCodes", user_id as "userId"
        `;
      } else {
        await tx.rollbackTransaction();
        return null;
      }

      const row = rows.length > 0 ? rows[0] : null;
      if (!row) {
        await tx.rollbackTransaction();
        return null;
      }

      assertDefined(row);
      assertProp(check(isString, isNumber), row, 'id');
      assertPropString(row, 'secret');
      assertPropString(row, 'backupCodes');
      assertProp(check(isString, isNumber), row, 'userId');

      await tx.commitTransaction();

      const result: BetterAuthRecord = {
        id: String(row.id),
        secret: row.secret,
        backupCodes: row.backupCodes,
        userId: String(row.userId),
      };

      return result;
    } catch (error) {
      console.error('BetterAuthRepository:betterAuthUpdateTwoFactor', error);
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async betterAuthUpdateManyTwoFactor(
    where: unknown,
    update: unknown,
  ): Promise<BetterAuthRecord[]> {
    const twoFactor = await this.betterAuthUpdateTwoFactor(where, update);
    return twoFactor ? [twoFactor] : [];
  }

  async betterAuthDeleteTwoFactor(where: unknown): Promise<BetterAuthRecord | null> {
    const tx = await this.beginTransaction();
    try {
      const conditions = ensureWhereConditions(
        where,
        'BetterAuthRepository.betterAuthDeleteTwoFactor where',
      );
      if (conditions.length === 0) {
        await tx.rollbackTransaction();
        return null;
      }

      const userIdCondition = conditions.find(condition => condition.field === 'userId');
      const idCondition = conditions.find(condition => condition.field === 'id');

      let rows: Array<unknown> = [];
      if (idCondition?.value !== undefined) {
        assertStringOrNumber(idCondition.value, 'Two-factor id must be string or number');
        rows = await tx.sql`
          DELETE FROM two_factor
          WHERE id = ${String(idCondition.value)}
          RETURNING id, secret, backup_codes as "backupCodes", user_id as "userId"
        `;
      } else if (userIdCondition?.value !== undefined) {
        assertStringOrNumber(userIdCondition.value, 'Two-factor userId must be string or number');
        rows = await tx.sql`
          DELETE FROM two_factor
          WHERE user_id = ${String(userIdCondition.value)}
          RETURNING id, secret, backup_codes as "backupCodes", user_id as "userId"
        `;
      } else {
        await tx.rollbackTransaction();
        return null;
      }

      const row = rows.length > 0 ? rows[0] : null;
      if (!row) {
        await tx.rollbackTransaction();
        return null;
      }

      assertDefined(row);
      assertProp(check(isString, isNumber), row, 'id');
      assertPropString(row, 'secret');
      assertPropString(row, 'backupCodes');
      assertProp(check(isString, isNumber), row, 'userId');

      await tx.commitTransaction();

      const result: BetterAuthRecord = {
        id: String(row.id),
        secret: row.secret,
        backupCodes: row.backupCodes,
        userId: String(row.userId),
      };

      return result;
    } catch (error) {
      console.error('BetterAuthRepository:betterAuthDeleteTwoFactor', error);
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async betterAuthDeleteManyTwoFactor(where: unknown): Promise<BetterAuthRecord[]> {
    const twoFactor = await this.betterAuthDeleteTwoFactor(where);
    return twoFactor ? [twoFactor] : [];
  }
}
