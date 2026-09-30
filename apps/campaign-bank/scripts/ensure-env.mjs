// Copies .env.example to .env when .env is missing so the app runs with no setup.
import { existsSync, copyFileSync } from 'node:fs';
if (!existsSync('.env')) {
  copyFileSync('.env.example', '.env');
  console.log('Created .env from .env.example');
}
