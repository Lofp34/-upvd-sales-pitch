import { defineConfig } from "drizzle-kit";
import { config as loadEnv } from "dotenv";

import { getDatabaseUrl } from "./src/lib/env";

loadEnv({ path: ".env.local", override: false });
loadEnv({ path: ".env", override: false });

const url =
  getDatabaseUrl() ??
  "postgresql://postgres:postgres@127.0.0.1:5432/upvd_sales_plan";

export default defineConfig({
  out: "./drizzle",
  schema: "./src/lib/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url,
  },
  verbose: true,
  strict: true,
});
