// Push token management types

import type { ExpoPushTicket } from 'expo-server-sdk';

export type PushTokenRegisterParams = {
  userId: string;
  pushToken: string;
  deviceId: string;
  deviceType: 'ios' | 'android';
  deviceName?: string;
  deviceModel?: string;
  currentSessionId: string;
  registeredDate: Date;
};

export type PushTokenRegisterResult = {
  id: string;
  userId: string;
  pushToken: string;
  deviceId: string | null;
  isNew: boolean; // true if created, false if updated
};

export type PushTokenUnregisterParams = {
  userId: string;
  currentSessionId: string;
};

export type PushTokenUnregisterResult = {
  tokensUpdated: number;
};

export type PushTokenSyncParams = {
  userId: string;
  pushToken?: string;
  deviceId?: string;
  currentSessionId: string;
  lastUsedDate: Date;
};

export type PushTokenSyncResult = {
  tokensSynced: number;
};

export type PushTokenListByUserParams = {
  userId: string;
  activeOnly?: boolean;
};

export type PushTokenListByUserResult = {
  tokens: Array<{
    id: string;
    pushToken: string;
    deviceId: string | null;
    deviceType: 'ios' | 'android';
    deviceName?: string | null;
    deviceModel?: string | null;
    currentSessionId?: string | null;
    isActive: boolean;
    lastUsedDate: Date;
  }>;
};

export type PushTokenGetActiveParams = {
  userId: string;
  targetDevices?: 'all' | 'active_sessions' | 'specific';
  deviceIds?: string[];
};

export type PushTokenGetActiveResult = {
  tokens: Array<{
    id: string;
    pushToken: string;
    deviceId: string | null;
    currentSessionId?: string | null;
  }>;
};

export type SendPushNotificationParams = {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  targetDevices?: 'all' | 'active_sessions' | 'specific';
  deviceIds?: string[];
  priority?: 'high' | 'normal';
};

export type SendPushNotificationResult = {
  sent: number;
  failed: number;
  tickets: ExpoPushTicket[];
};

export type CleanupStaleTokensResult = {
  staleTokensDeactivated: number;
};

export type CleanupOrphanedSessionsResult = {
  orphanedSessionsNullified: number;
};
