import { InMemoryCryptogadaiRepository } from './in-memory-cryptogadai.repository';
import { runLoanPlatformRepositoryTestSuite } from './loan-platform.repository-test-case';

runLoanPlatformRepositoryTestSuite(
  async function () {
    const repo = new InMemoryCryptogadaiRepository();
    await repo.connect();
    return repo;
  },
  async function (repo) {
    await repo.close();
  },
);
