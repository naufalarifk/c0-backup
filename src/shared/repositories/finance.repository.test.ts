import { runFinanceRepositoryTestSuite } from './finance.repository-test-suite';
import { InMemoryCryptogadaiRepository } from './in-memory-cryptogadai.repository';

runFinanceRepositoryTestSuite(
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
