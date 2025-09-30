import { InMemoryCryptogadaiRepository } from './in-memory-cryptogadai.repository';
import { runUserRepositoryTestSuite } from './user.repository-test-suite';

runUserRepositoryTestSuite(
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
