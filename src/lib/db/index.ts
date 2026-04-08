import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import { assertDatabaseUrl } from "@/lib/env";
import * as schema from "@/lib/db/schema";

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (!dbInstance) {
    const client = neon(assertDatabaseUrl());
    dbInstance = drizzle(client, { schema });
  }

  return dbInstance;
}
