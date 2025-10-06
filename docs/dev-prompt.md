```
claude --dangerously-skip-permissions --model claude-sonnet-4-20250514 --append-system-prompt 'Claude shall act as Backend Developer focusing on nodejs ecosystem.'
```

```
Your task is to write e2e test for finance accounting feature.

Test shall refer to finance accounting api documentation.
Test shall refer to 0008-finance.sql for data source schema.
Test flow shall refer to ui description.
Test shall use `TestController` to setup scenario data.

Expected result is proper e2e test strategy implementation in test directory following current structure and setup properly.
```

```
Your responsibility is to develop CryptoGadai backend. Your scope includes all backend layers from schema, database, services, controllers, and tests related to @docs/api-plan/loan-market-openapi.yaml . Your task is to ensure that e2e test are properly implemented following specification and test guidelines. Run the test using command `pnpm build && node --import tsx --test $TEST_FILE_PATH`, the test files includes `./test/loan-market-applications.test.ts`, `./test/loan-market-edge-cases.test.ts`, and `./test/loan-market-offers.test.ts`
```

```
Your responsibility is to develop CryptoGadai backend. Your scope includes all backend layers from schema, database, services, controllers, and tests related to @docs/api-plan/loan-market-openapi.yaml . Your task is to add new endpoints: loan-offers details and loan-applications detail. Expected result are updated schema, implemented endpoints, and e2e tested. Run the test using command `pnpm build && node --import tsx --test $TEST_FILE_PATH`, the test files includes `./test/loan-market-applications.test.ts` and `./test/loan-market-offers.test.ts`
```

```
Your task is to continue the refactor of @src/shared/repositories/finance-user.repository.ts

Current structure:
- method with single argument with defined type
- params mostly destructured
- SQL query resulting in snake_case structure
- type assertion for resulting query
- mapping to return type structure

Desired structure:
- method with single argument with defined type
- params used directly instead of destructuring
- SQL query resulting in return type structure with proper aliasing from snake_case to camelCase, from table columns name to repository type property name
- type assertion for resulting query using type using typeshaper
- return resulting query directly without mapping if possible. This part will be challenging removing mapping entirely is hard due to SQL result structure is hard to align with return type structure. So just try to minimize mapping as much as possible.

The target of the refactor is to make the code more compact and efficient while maintaining clarity and type safety.

Verify the refactor by running test `node --import tsx --test ./src/shared/repositories/finance.repository.test.ts` and type check `npx --package typescript tsc --noEmit`

```
Your task is to make sure that loan match test flows is as follow:
- test setup user lender
- test listen to realtime websocket event for user lender
- user lender creates loan offer
- test simulate loan offer invoice payment
- backend send realtime websocket event to test
- test receive realtime websocket event for loan offer published
- test setup user borrower
- test listen to realtime websocket event for user borrower
- user borrower creates loan application
- test simulate loan application collateral invoice payment
- backend send realtime websocket event to test
- test receive realtime websocket event for collateral invoice paid
- backend match loan offer and loan application
- user lender and user borrower receive realtime websocket event for loan matched
- test verify loan offer and loan application status after matched

Align the test suite with the above flow: `CG_BACKEND_LOGS=0 timeout 60 node --import tsx --test test/loan-match-realtime.test.ts`
```
