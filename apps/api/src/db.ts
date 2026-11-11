import { Pool } from 'pg';

// Dois timeouts, porque o banco pode falhar de dois jeitos:
// - connectionTimeoutMillis: o banco não aceita a conexão (fora do ar, rede bloqueada);
// - query_timeout: a conexão abre, mas a query não volta (banco travado, sem CPU).
// Sem o segundo, o /health ficaria pendurado em vez de responder degraded.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 2000,
  query_timeout: 2000,
});

// Erro em cliente ocioso do pool (ex.: banco derrubou a conexão) emite 'error' no Pool.
// Sem esse listener, o Node trata como exceção não tratada e derruba o processo inteiro —
// exatamente o que a degradação graciosa do /health existe pra evitar.
pool.on('error', (error) => {
  console.error('Erro em cliente ocioso do pool do Postgres:', error);
});

export async function checkDatabase(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}
