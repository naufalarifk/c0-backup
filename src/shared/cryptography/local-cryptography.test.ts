import { runCryptographyServiceTestSuite } from './cryptography-test-suite';
import { LocalCryptographyService } from './local-cryptography.service';

runCryptographyServiceTestSuite(
  async function setup() {
    return new LocalCryptographyService({
      cryptographyConfig: {
        localEncryptionKey: '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
      },
    });
  },
  async function stop(service) {
    // Nothing to do
  },
);
