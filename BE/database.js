import sql from 'mssql';

export async function connectDatabase(config) {
  const pool = await new sql.ConnectionPool(config).connect();
  pool.on('error', error => console.error('SQL Server:', error.message));
  try { await pool.request().query('SELECT TOP 1 id FROM dbo.Users; SELECT TOP 1 id FROM dbo.ActionHistory;'); }
  catch (error) { await pool.close(); throw error; }
  return pool;
}

export { sql };
