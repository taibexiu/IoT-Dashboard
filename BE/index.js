import { readConfig } from './config.js';
import { connectDatabase } from './database.js';
import { sqlStore, demoStore } from './store.js';
import { createBackend } from './app.js';

let backend;
try {
  const config = readConfig();
  const store = config.mode === 'demo' ? await demoStore() : sqlStore(await connectDatabase(config.database));
  if (config.mode === 'sql') await store.recoverActions();
  backend = createBackend(store, config);
  backend.server.on('error', async error => {
    console.error(error.code === 'EADDRINUSE' ? `Cổng ${config.port} đang được dùng. Dừng BE cũ hoặc đổi PORT trong .env.` : error.message);
    await backend.close(); process.exitCode = 1;
  });
  backend.server.listen(config.port, config.host, () => console.log(`BE: http://${config.host}:${config.port} | WebSocket: /ws | dữ liệu: ${config.mode}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await backend.close(); process.exit(0); });
} catch (error) {
  console.error(`Không khởi động được BE: ${error.message}`);
  console.error('Kiểm tra BE/.env và chạy dataseed.sql trong SQL Server trước. Có thể dùng DATA_MODE=demo để thử.');
  process.exitCode = 1;
}
