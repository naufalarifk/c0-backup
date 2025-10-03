import type { LoanOfferStatus, LoanStatus } from '../../shared/repositories/loan.types';
import type { NotificationType } from '../../shared/repositories/user.types';

export const RealtimeEventTypeEnum = {
  NotificationCreated: 'notification.created',
  LoanStatusChanged: 'loan.status.changed',
  LoanOfferUpdated: 'loan.offer.updated',
} as const;

export type RealtimeEventType = (typeof RealtimeEventTypeEnum)[keyof typeof RealtimeEventTypeEnum];

export interface NotificationCreatedRealtimePayload {
  notificationId: string;
  type: NotificationType;
  title: string;
  content: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface LoanStatusChangedRealtimePayload {
  loanId: string;
  status: LoanStatus;
  previousStatus?: LoanStatus;
  updatedAt: string;
  loanApplicationId?: string;
  loanOfferId?: string;
  ltvRatio?: number;
}

export interface LoanOfferUpdatedRealtimePayload {
  loanOfferId: string;
  status: LoanOfferStatus;
  availablePrincipalAmount: string;
  updatedAt: string;
  matchedLoanApplicationId?: string;
}

export interface RealtimeEventPayloads {
  [RealtimeEventTypeEnum.NotificationCreated]: NotificationCreatedRealtimePayload;
  [RealtimeEventTypeEnum.LoanStatusChanged]: LoanStatusChangedRealtimePayload;
  [RealtimeEventTypeEnum.LoanOfferUpdated]: LoanOfferUpdatedRealtimePayload;
}

export type RealtimeEventPayload<T extends RealtimeEventType> = RealtimeEventPayloads[T];

export interface RealtimeEvent<T extends RealtimeEventType = RealtimeEventType> {
  userId: string;
  type: T;
  data: RealtimeEventPayload<T>;
  timestamp: string;
}

export interface RealtimeBroadcastEvent<T extends RealtimeEventType = RealtimeEventType>
  extends RealtimeEvent<T> {}

export function isRealtimeEventType(value: unknown): value is RealtimeEventType {
  return (
    typeof value === 'string' &&
    (Object.values(RealtimeEventTypeEnum) as readonly string[]).includes(value as RealtimeEventType)
  );
}
