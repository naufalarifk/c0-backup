import { argv } from 'node:process';

import { notificationEntrypoint } from './entrypoints/notification.entrypoint';
import { userApiEntrypoint } from './entrypoints/user-api.entrypoint';

const [, , ...commands] = argv;

if (commands.includes('api')) {
  void userApiEntrypoint();
}
if (commands.includes('notification')) {
  void notificationEntrypoint();
}
