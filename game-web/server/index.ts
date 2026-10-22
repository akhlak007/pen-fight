import { createRoomServer } from './room-server';
import { runtimeConfig } from './runtime-config';

const app = createRoomServer(runtimeConfig());
let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}; closing Pen Fight cleanly.`);
  const forceExit = setTimeout(() => process.exit(1), 25_000);
  forceExit.unref();
  try {
    await app.close();
    clearTimeout(forceExit);
    process.exit(0);
  } catch (error) {
    console.error('Pen Fight shutdown failed.', error);
    process.exit(1);
  }
}

process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));

app.listen()
  .then((actualPort) => console.log(`Pen Fight server ready on http://0.0.0.0:${actualPort}`))
  .catch((error) => {
    console.error('Pen Fight could not start.', error);
    void app.close().catch((closeError) => console.error('Pen Fight startup cleanup failed.', closeError)).finally(() => {
      process.exitCode = 1;
    });
  });
