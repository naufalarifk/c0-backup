import { runBaseRepositoryTestSuite } from './base.repository-test-suite';
import { InMemoryCryptogadaiRepository } from './in-memory-cryptogadai.repository';

runBaseRepositoryTestSuite(
  async function createRepo() {
    const repo = new InMemoryCryptogadaiRepository();
    await repo.connect();
    await repo.migrate();
    return repo;
  },
  async function teardownRepo(repo) {
    await repo.close();
  },
);
