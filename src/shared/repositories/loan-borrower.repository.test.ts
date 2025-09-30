import { InMemoryCryptogadaiRepository } from './in-memory-cryptogadai.repository';
import { runLoanBorrowerRepositoryTestSuite } from './loan-borrower.repository-test-suite';

runLoanBorrowerRepositoryTestSuite(
  async function () {
    const repo = new InMemoryCryptogadaiRepository();
    await repo.connect();
    await repo.migrate();
    return repo;
  },
  async function (repo) {
    await repo.close();
  },
);
