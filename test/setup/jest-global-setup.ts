import { TestContainerSetup } from './test-containers';

export default async function globalSetup() {
  await TestContainerSetup.startContainers();
}
