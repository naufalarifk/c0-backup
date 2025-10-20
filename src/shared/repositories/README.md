# Repository

This module focus on managing data access and storage through a structured repository with use-case based methods. Current repository implementation are combination of PostgreSQL and Redis.

## Rules

- Reponsibility of repository is to access and store data. All business logic calculations shall be done outside repository.
- All monetary values in and out of repository shall be in smallest unit (Lamports, Satoshi, Wei, etc). The smallest unit is defined by `decimals` column in `currencies` table.

## Structure

- Repositories are structured as linear dependencies, beginning from BaseRepository and ending with CryptogadaiRepository. The full chains is: CryptogadaiRepository <- LoanPlatformRepository <- LoanUserRepository <- LoanBorrowerRepository <- LoanLenderRepository <- LoanTestRepository <- FinanceRepository <- UserRepository <- DatabaseRepository
- Repository names are made of 2 parts: {Scope}{Subject/Actor}.
- Repository's method names are each consists of 2-3 parts: {Subject/Actor}{Predicate/Action}{Object/Target}. Each method represents a use-case.
- The main PostgreSQL schemas are defined in `src/shared/repositories/postgres/*.sql`.
- The database implementations are `InMemoryCryptogadaiRepository` and `PgRedisCryptogadaiRepository`. Both implement the `CryptogadaiRepository` abstract class.

## Repository SQL Writings

- All status MUST use CamelCase, example: `InProgress`, `Completed`, `Failed`.
- All time-based MUST use `TIMESTAMPT` type with `_date` suffix.
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
  import { assertDefined, assertArrayMapOf, assertPropString, assertPropNullableString } from 'typeshaper';
  const userRows = await repo.sql`SELECT id, email, name FROM users`;
  // from here, the userRows variable is still of type Array<unknown>
  assertArrayMapOf(userRows, function (row) {
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

## Repository Method Guidelines
- Begin with transaction when performing write operations.
- Implement single argument repository method with defined type.
- Use params directly instead of destructuring.
- Write SQL query that resulting structure is closest to the return type with proper aliasing. For example:
  ```typescript
  import { assertDefined, assertArrayMapOf, assertPropString, assertPropNullableString, setPropValue } from 'typeshaper';
  type UserViewsProfileParams = {
    userId: string;
  };
  type UserViewsProfileResult = {
    userId: string;
    userEmail: string;
    userBio: string | null;
    verifiedDate: string | null;
    isVerified: boolean;
  };
  async function userViewsProfile(params: UserViewsProfileParams): Promise<UserViewsProfileResult | null> {
    const userRows = await this.sql`
      SELECT
        users.id AS "userId",
        users.email AS "userEmail",
        user_profiles.bio AS "userBio",
        user_profiles.verified_date AS "verifiedDate"
      FROM users
      LEFT JOIN user_profiles ON user_profiles.user_id = users.id
      WHERE users.id = ${params.userId}
    `;
    assertArrayMapOf(userRows, function (row) {
      assertDefined(row);
      assertPropString(row, 'userId');
      assertPropString(row, 'userEmail');
      assertPropNullableString(row, 'userBio');
      assertPropNullableString(row, 'verifiedDate');
      setPropValue(row, 'isVerified', row.verifiedDate !== null);
      return row;
    });
    if (userRows.length === 0) {
      return null;
    }
    const userRow = userRows[0];
    return userRow;
  }
  ```

## Repository Test Guidelines

- Repository test is implemented in `*.repository-test-suite.ts` files that will be executed by corresponding `*.repository.test.ts` files.
- Run test by command `node --import tsx --test $RELATIVE_PATH_TO_TEST_FILE`. For example: `node --import tsx --test ./src/shared/repositories/user.repository.test.ts`
