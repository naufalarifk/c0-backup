import { equal, ok } from 'node:assert';

import { assertDefined, assertPropString } from 'typeshaper';

import { afterEach, beforeEach, describe, it, suite } from '../utils/early-exit-node-test';
import { CryptographyService } from './cryptography.service';

export async function runCryptographyServiceTestSuite(
  setupCryptographyService: () => Promise<CryptographyService>,
  stopCryptographyService: (service: CryptographyService) => Promise<void>,
) {
  await suite('CryptographyService', function () {
    let cryptography: CryptographyService;

    beforeEach(async function () {
      cryptography = await setupCryptographyService();
    });

    afterEach(async function () {
      await stopCryptographyService(cryptography);
    });

    describe('getSecret', function () {
      it('should retreive data', async function () {
        const path = `test/${Date.now()}`;
        const data = { foo: 'bar' };
        await cryptography.writeSecret(path, data);
        const secret = await cryptography.getSecret(path);
        assertDefined(secret);
        assertPropString(secret, 'foo');
        equal(secret.foo, data.foo);
      });

      it('should return null for non-existing secret', async function () {
        const path = `test/${Date.now()}-non-existing`;
        const secret = await cryptography.getSecret(path);
        ok(secret === null);
      });
    });

    describe('writeSecret', function () {
      it('should write data', async function () {
        const path = `test/${Date.now()}`;
        const data = { foo: 'bar' };
        await cryptography.writeSecret(path, data);
        const secret = await cryptography.getSecret(path);
        assertDefined(secret);
        assertPropString(secret, 'foo');
        equal(secret.foo, data.foo);
      });

      it('should overwrite existing data', async function () {
        const path = `test/${Date.now()}`;
        const data1 = { foo: 'bar' };
        const data2 = { foo: 'baz' };
        await cryptography.writeSecret(path, data1);
        let secret = await cryptography.getSecret(path);
        assertDefined(secret);
        assertPropString(secret, 'foo');
        equal(secret.foo, data1.foo);
        await cryptography.writeSecret(path, data2);
        secret = await cryptography.getSecret(path);
        assertDefined(secret);
        assertPropString(secret, 'foo');
        equal(secret.foo, data2.foo);
      });
    });

    describe('deleteSecret', function () {
      it('should delete existing secret', async function () {
        const path = `test/${Date.now()}`;
        const data = { foo: 'bar' };
        await cryptography.writeSecret(path, data);
        let secret = await cryptography.getSecret(path);
        assertDefined(secret);
        assertPropString(secret, 'foo');
        equal(secret.foo, data.foo);
        await cryptography.deleteSecret(path);
        secret = await cryptography.getSecret(path);
        ok(secret === null);
      });

      it('should not fail for non-existing secret', async function () {
        const path = `test/${Date.now()}-non-existing`;
        await cryptography.deleteSecret(path);
      });
    });

    describe('encrypt and decrypt', function () {
      const keyName = 'test-key';
      const plaintext = 'Hello, World!';

      it('should encrypt and decrypt data', async function () {
        const encResult = await cryptography.encrypt(keyName, plaintext);
        assertDefined(encResult);
        assertPropString(encResult, 'ciphertext');
        assertPropString(encResult, 'keyId');
        ok(encResult.ciphertext.length > 0);
        ok(encResult.keyId.length > 0);

        const decResult = await cryptography.decrypt(keyName, encResult.ciphertext);
        assertDefined(decResult);
        assertPropString(decResult, 'plaintext');
        assertPropString(decResult, 'keyId');
        equal(decResult.plaintext, plaintext);
        equal(decResult.keyId, encResult.keyId);
      });
    });
  });
}
