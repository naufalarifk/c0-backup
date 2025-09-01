import { TestContainerSetup } from './test-containers';

export default async function globalTeardown() {
  await TestContainerSetup.stopContainers();
}
