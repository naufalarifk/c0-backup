import { InMemoryCryptogadaiRepository } from './in-memory-cryptogadai.repository';
import { runLoanRepositoryTestSuite } from './loan.repository-test-suite';

runLoanRepositoryTestSuite(
  async function () {
    const repo = new InMemoryCryptogadaiRepository();
    await repo.connect();
    return repo;
  },
  async function (repo) {
    await repo.close();
  },
);
