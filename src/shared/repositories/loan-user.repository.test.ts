import { InMemoryCryptogadaiRepository } from './in-memory-cryptogadai.repository';
import { runLoanUserRepositoryTestSuite } from './loan-user.repository-test-suite';

runLoanUserRepositoryTestSuite(
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
