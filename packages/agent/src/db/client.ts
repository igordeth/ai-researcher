import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from './schema.js';

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const db = drizzle(pool, { schema });

// Quem consulta o banco recebe o db por parâmetro, tipado assim, em vez de importar o `db` acima.
// Mantém as funções de consulta independentes de uma conexão específica.
export type Database = typeof db;
