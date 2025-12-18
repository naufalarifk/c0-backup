#!/usr/bin/env node
// @ts-check

import { exec } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync, unlinkSync } from 'node:fs';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pidFile = join(__dirname, '..', '.local', 'test-server.json');

if (!existsSync(pidFile)) {
  console.log('No test server running');
  process.exit(1);
}

const data = JSON.parse(readFileSync(pidFile, 'utf8'));

// Kill the backend process
try {
  process.kill(data.pid, 'SIGTERM');
  console.log('Backend process killed');
} catch (e) {
  console.log('Failed to kill backend process:', e);
}

// Stop containers
for (const container of data.containers) {
  try {
    await execAsync(`docker stop ${container.id}`);
    console.log(`Container ${container.type} (${container.id}) stopped`);
  } catch (error) {
    console.log(`Failed to stop container ${container.type} (${container.id}):`, error);
  }
}

unlinkSync(pidFile);
console.log('Test server stopped');
