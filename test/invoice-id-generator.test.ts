import { ok, strictEqual } from 'node:assert/strict';

import { InvoiceIdGenerator } from '../src/shared/invoice/invoice-id.generator';
import { it, suite } from './setup/test';

type InvoiceIdGeneratorDeps = ConstructorParameters<typeof InvoiceIdGenerator>[0];

class StubAppConfigService {
  constructor(private readonly workerId: number) {}

  get invoiceConfig() {
    return {
      epochMs: Date.UTC(2024, 0, 1),
      workerId: this.workerId,
    };
  }
}

suite('InvoiceIdGenerator', function () {
  it('generates monotonically increasing identifiers', async function () {
    const generator = new InvoiceIdGenerator(
      new StubAppConfigService(0) as unknown as InvoiceIdGeneratorDeps,
    );

    const generated = new Set<number>();
    let previous = 0;

    for (let index = 0; index < 128; index++) {
      const nextId = generator.generate();
      ok(Number.isSafeInteger(nextId), 'Invoice id should be a safe integer');
      ok(nextId > previous, 'Invoice ids must be strictly increasing');
      ok(!generated.has(nextId), 'Invoice ids must be unique within the generator');
      generated.add(nextId);
      previous = nextId;
    }

    strictEqual(generated.size, 128);
  });

  it('applies worker id offset to identifiers', async function () {
    const generatorA = new InvoiceIdGenerator(
      new StubAppConfigService(0) as unknown as InvoiceIdGeneratorDeps,
    );

    const generatorB = new InvoiceIdGenerator(
      new StubAppConfigService(5) as unknown as InvoiceIdGeneratorDeps,
    );

    const idA = generatorA.generate();
    const idB = generatorB.generate();

    ok(
      idA !== idB,
      'Generators with different worker ids should not collide for the same timestamp',
    );
  });
});
