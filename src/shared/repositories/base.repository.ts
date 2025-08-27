export abstract class BaseRepository {
  abstract connect(): Promise<void>;
  abstract close(): Promise<void>;
  abstract sql(query: TemplateStringsArray, ...params: unknown[]): Promise<unknown>;
  abstract rawQuery(queryText: string, params: unknown[]): Promise<unknown>;

  // Redis abstraction
  abstract set(key: string, value: unknown, ttl?: number): Promise<void>;
  abstract setex(key: string, seconds: number, value: unknown): Promise<void>;
  abstract expire(key: string, seconds: number): Promise<void>;
  abstract ttl(key: string): Promise<number>;
  abstract persist(key: string): Promise<void>;
  abstract del(key: string): Promise<void>;
  abstract get(key: string): Promise<unknown>;
}
