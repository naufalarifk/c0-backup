import { networkInterfaces } from 'node:os';
import { argv, env } from 'node:process';

import { indexerEntrypoint } from './entrypoints/indexer.entrypoint';
import { invoiceExpirationEntrypoint } from './entrypoints/invoice-expiration.entrypoint';
import { notificationEntrypoint } from './entrypoints/notification.entrypoint';
import { userApiEntrypoint } from './entrypoints/user-api.entrypoint';

const [, , ...commands] = argv;

if ('BETTER_AUTH_URL' in env && env.BETTER_AUTH_URL === 'local') {
  env.BETTER_AUTH_URL = getDefaultAuthUrl();
}

if (commands.includes('api')) {
  void userApiEntrypoint();
}

if (commands.includes('notification')) {
  void notificationEntrypoint();
}

if (commands.includes('invoice-expiration')) {
  void invoiceExpirationEntrypoint();
}

if (commands.includes('indexer')) {
  void indexerEntrypoint();
}

function getDefaultAuthUrl(): string {
  const defaultIP = getLocalNetworkIP();
  const defaultPort = 'PORT' in env ? env.PORT : '3000';
  if (typeof defaultIP === 'string') {
    return `http://${defaultIP}:${defaultPort}`;
  }
  return 'http://localhost:3000';
}

function getLocalNetworkIP(): string | null {
  const interfaces = networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]!) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return null;
}
