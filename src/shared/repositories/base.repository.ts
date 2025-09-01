export abstract class DbRepository {
  abstract sql(query: TemplateStringsArray, ...params: unknown[]): Promise<Array<unknown>>;
  abstract rawQuery(queryText: string, params: unknown[]): Promise<unknown>;
  abstract commitTransaction(): Promise<void>;
  abstract rollbackTransaction(): Promise<void>;
}

export abstract class BaseRepository extends DbRepository {
  abstract connect(): Promise<void>;
  abstract close(): Promise<void>;

  // Transaction methods
  abstract beginTransaction(): Promise<DbRepository>;

  // Redis abstraction
  abstract set(key: string, value: unknown, ttl?: number): Promise<void>;
  abstract setex(key: string, seconds: number, value: unknown): Promise<void>;
  abstract expire(key: string, seconds: number): Promise<void>;
  abstract ttl(key: string): Promise<number>;
  abstract persist(key: string): Promise<void>;
  abstract del(key: string): Promise<void>;
  abstract get(key: string): Promise<unknown>;
}
