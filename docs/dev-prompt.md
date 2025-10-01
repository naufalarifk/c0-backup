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
