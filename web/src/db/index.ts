import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "../lib/env";
import * as schema from "./schema";

let _db: NodePgDatabase<typeof schema> | undefined;

export const db = new Proxy({} as NodePgDatabase<typeof schema>, {
  get(_target, prop) {
    if (!_db) {
      const pool = new Pool({ connectionString: env.DATABASE_URL });
      _db = drizzle(pool, { schema });
    }
    return (_db as unknown as Record<string | symbol, unknown>)[prop];
  },
});
