# Repository

This module focus on managing data access and storage through a structured repository with use-case based methods. Current repository implementation are combination of PostgreSQL and Redis.

## Structure

- Repositories are structured as linear dependencies, beginning from BaseRepository and ending with CryptogadaiRepository. The full chains is: CryptogadaiRepository <- LoanPlatformRepository <- LoanUserRepository <- LoanBorrowerRepository <- LoanLenderRepository <- LoanTestRepository <- FinanceRepository <- UserRepository <- DatabaseRepository
- Repository names are made of 2 parts: {Scope}{Subject/Actor}.
- Repository's method names are each consists of 2-3 parts: {Subject/Actor}{Predicate/Action}{Object/Target}. Each method represents a use-case.
- The main PostgreSQL schemas are defined in `src/shared/repositories/postgres/*.sql`.
- The database implementations are `InMemoryCryptogadaiRepository` and `PgRedisCryptogadaiRepository`. Both implement the `CryptogadaiRepository` abstract class.

## SQL Writings

- Always write static query when using `sql` tagged function. Example:
  ```typescript
  const repo: CryptogadaiRepository;
  const email: string|null;
  const userRows = await repo.sql`
    SELECT *
    FROM users
    WHERE ${email} = NULL OR users.email = ${email}
  `;
  ```
- Prioritize using `sql` tagged function instead of `rawQuery`.
- When static query using `sql` tagged function not possible, we can use dynamic query. Example:
  ```typescript
  const repo: CryptogadaiRepository;
  const email: string|null;
  const sqlParams = [];
  const whereClauses = [];
  if (email) {
    sqlParams.push(email);
    whereClauses.push(`AND users.email = $${sqlParams.length}`);
  }
  const userRows = await repo.rawQuery(`
    SELECT *
    FROM users
    WHERE 1 = 1 ${whereClauses.join(' AND ')}
  `, sqlParams);
  ```
- The result form `sql` tagged function and `rawQuery` method are the same, which is an array of rows of unknown type `Array<unknown>`. We must strongly type resulting query using type assertion:
  ```typescript
  import { assertDefined, assertArrayOf, assertPropString, assertPropNullableString } from '../utils/assertions.ts';
  const userRows = await repo.sql`SELECT id, email, name FROM users`;
  // from here, the userRows variable is still of type Array<unknown>
  assertArrayOf(userRows, function (row) {
    assertDefined(row);
    assertPropString(row, 'id');
    assertPropNullableString(row, 'email');
    assertPropString(row, 'name');
    return row;
  });
  // from now on, the userRows variable will be automatically casted by TypeScript as: Array<{id: string; email: string|null; name: string;}>
  ```
- Always use transactional queries when performing write operations that involve multiple queries. Example:
  ```typescript
  const tx = await repo.beginTransaction();
  try {
    await tx.sql`INSERT INTO users (id, email, name) VALUES (${id}, ${email}, ${name})`;
    await tx.sql`INSERT INTO user_profiles (user_id, bio) VALUES (${id}, ${bio})`;
    await tx.commitTransaction();
  } catch (error) {
    await tx.rollbackTransaction();
    throw error;
  }
  ```
