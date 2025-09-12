import { InMemoryCryptogadaiRepository } from './in-memory-cryptogadai.repository';
import { runLoanLenderRepositoryTestSuite } from './loan-lender.repository-test-suite';

runLoanLenderRepositoryTestSuite(
  async function () {
    const repo = new InMemoryCryptogadaiRepository();
    await repo.connect();
    return repo;
  },
  async function (repo) {
    await repo.close();
  },
);
