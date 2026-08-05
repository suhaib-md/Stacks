import { defineConfig } from "drizzle-kit";

// Generates SQL migrations into ./drizzle from src/db/schema.ts.
// Applying them is a separate, deliberate step via wrangler — never part of the build.
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  driver: "d1-http",
  verbose: true,
  strict: true,
});
