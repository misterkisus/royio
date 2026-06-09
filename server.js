// Entry point. Run: `npm start` (or `node server.js`). Then open http://localhost:3000
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { GameServer } from './src/server/GameServer.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT) || 3000;

const server = new GameServer({ root, port });
server.start();

process.on('SIGINT', () => { console.log('\nстоп.'); server.stop(); process.exit(0); });
