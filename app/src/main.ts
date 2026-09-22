/** Ponto de entrada do processo. */
import { loadConfig } from './config.ts';
import { openDatabase } from './infra/db.ts';
import { buildServer } from './http/server.ts';

async function main(): Promise<void> {
  const config = loadConfig();
  const db = openDatabase(config.databaseFile);
  const app = await buildServer(db, config);

  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.once(signal, () => {
      app.log.info({ signal }, 'encerrando');
      void app.close().then(() => {
        db.close();
        process.exit(0);
      });
    });
  }

  await app.listen({ port: config.port, host: config.host });
}

main().catch((error: unknown) => {
  console.error('falha ao iniciar:', error instanceof Error ? error.message : error);
  process.exit(1);
});
