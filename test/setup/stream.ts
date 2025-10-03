import { Writable } from 'node:stream';

export class WritableString extends Writable {
  private chunks: Array<unknown> = [];

  _write(chunk: unknown, encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    this.chunks.push(chunk);
    callback();
  }

  toString(): string {
    return this.chunks
      .map(function (chunk) {
        if (chunk instanceof Buffer) {
          return chunk.toString('utf-8');
        } else if (typeof chunk === 'string') {
          return chunk;
        } else {
          return String(chunk);
        }
      })
      .join('');
  }
}
