import { InMemoryCryptogadaiRepository } from './in-memory-cryptogadai.repository';
import { runPricefeedRepositoryTestSuite } from './pricefeed.repository-test-suite';

runPricefeedRepositoryTestSuite(
  async function () {
    const repo = new InMemoryCryptogadaiRepository();
    await repo.connect();
    return repo;
  },
  async function (repo) {
    await repo.close();
  },
);
