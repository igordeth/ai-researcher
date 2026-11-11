import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  // Só o `drizzle-kit migrate`/`push` usa a URL. O `drizzle-kit generate` compara o schema com
  // as migrations já geradas e funciona sem banco.
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
});
