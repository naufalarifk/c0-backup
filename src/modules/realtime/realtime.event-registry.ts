import type { LoanOfferStatus, LoanStatus } from '../../shared/repositories/loan.types';

import { Injectable } from '@nestjs/common';

import {
  assertDefined,
  assertProp,
  assertPropString,
  check,
  isNullable,
  isNumber,
  isString,
} from 'typeshaper';

import { type NotificationType, notificationTypes } from '../../shared/repositories/user.types';
import { TelemetryLogger } from '../../shared/telemetry.logger';
import { RealtimeEventPayload, RealtimeEventType, RealtimeEventTypeEnum } from './realtime.types';

type RealtimeEventValidator<T extends RealtimeEventType> = (
  payload: unknown,
) => RealtimeEventPayload<T>;

const loanStatuses: readonly LoanStatus[] = [
  'Originated',
  'Active',
  'Liquidated',
  'Repaid',
  'Defaulted',
];
const loanOfferStatuses: readonly LoanOfferStatus[] = ['Funding', 'Published', 'Closed', 'Expired'];

function isNotificationType(value: unknown): value is NotificationType {
  return (
    typeof value === 'string' &&
    (notificationTypes as readonly string[]).includes(value as NotificationType)
  );
}

function isLoanStatus(value: unknown): value is LoanStatus {
  return typeof value === 'string' && (loanStatuses as readonly string[]).includes(value);
}

function isLoanOfferStatus(value: unknown): value is LoanOfferStatus {
  return typeof value === 'string' && (loanOfferStatuses as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

@Injectable()
export class RealtimeEventRegistry {
  private readonly logger = new TelemetryLogger(RealtimeEventRegistry.name);
  private readonly validators = new Map<
    RealtimeEventType,
    RealtimeEventValidator<RealtimeEventType>
  >();

  register<T extends RealtimeEventType>(type: T, validator: RealtimeEventValidator<T>): void {
    this.validators.set(type, validator as RealtimeEventValidator<RealtimeEventType>);
  }

  has(type: RealtimeEventType): boolean {
    return this.validators.has(type);
  }

  validate<T extends RealtimeEventType>(type: T, payload: unknown): RealtimeEventPayload<T> {
    const validator = this.validators.get(type) as RealtimeEventValidator<T> | undefined;

    if (!validator) {
      const error = new Error(`No validator registered for realtime event type ${type}`);
      this.logger.error(error.message);
      throw error;
    }

    return validator(payload);
  }
}

function validateNotificationCreatedEvent(payload: unknown) {
  assertDefined(payload);
  assertPropString(payload, 'notificationId');
  assertProp(isNotificationType, payload, 'type');
  assertPropString(payload, 'title');
  assertPropString(payload, 'content');
  assertPropString(payload, 'createdAt');

  const typedPayload = payload as {
    notificationId: string;
    type: NotificationType;
    title: string;
    content: string;
    createdAt: string;
    metadata?: unknown;
  };

  const metadataValue = typedPayload.metadata;

  if ('metadata' in payload && metadataValue !== undefined) {
    if (!isRecord(metadataValue)) {
      throw new TypeError('metadata must be an object when provided');
    }
  }

  return {
    notificationId: typedPayload.notificationId,
    type: typedPayload.type,
    title: typedPayload.title,
    content: typedPayload.content,
    createdAt: typedPayload.createdAt,
    metadata: isRecord(metadataValue) ? metadataValue : undefined,
  };
}

function validateLoanStatusChangedEvent(payload: unknown) {
  assertDefined(payload);
  assertPropString(payload, 'loanId');
  assertProp(isLoanStatus, payload, 'status');
  assertPropString(payload, 'updatedAt');
  assertProp(check(isNullable, isLoanStatus), payload, 'previousStatus');
  assertProp(check(isNullable, isString), payload, 'loanApplicationId');
  assertProp(check(isNullable, isString), payload, 'loanOfferId');
  assertProp(check(isNullable, isNumber), payload, 'ltvRatio');

  const typedPayload = payload as {
    loanId: string;
    status: LoanStatus;
    updatedAt: string;
    previousStatus?: LoanStatus | null;
    loanApplicationId?: string | null;
    loanOfferId?: string | null;
    ltvRatio?: number | null;
  };

  return {
    loanId: typedPayload.loanId,
    status: typedPayload.status,
    previousStatus: typedPayload.previousStatus ?? undefined,
    updatedAt: typedPayload.updatedAt,
    loanApplicationId: typedPayload.loanApplicationId ?? undefined,
    loanOfferId: typedPayload.loanOfferId ?? undefined,
    ltvRatio: typedPayload.ltvRatio ?? undefined,
  };
}

function validateLoanOfferUpdatedEvent(payload: unknown) {
  assertDefined(payload);
  assertPropString(payload, 'loanOfferId');
  assertProp(isLoanOfferStatus, payload, 'status');
  assertPropString(payload, 'availablePrincipalAmount');
  assertPropString(payload, 'updatedAt');
  assertProp(check(isNullable, isString), payload, 'matchedLoanApplicationId');

  const typedPayload = payload as {
    loanOfferId: string;
    status: LoanOfferStatus;
    availablePrincipalAmount: string;
    updatedAt: string;
    matchedLoanApplicationId?: string | null;
  };

  return {
    loanOfferId: typedPayload.loanOfferId,
    status: typedPayload.status,
    availablePrincipalAmount: typedPayload.availablePrincipalAmount,
    updatedAt: typedPayload.updatedAt,
    matchedLoanApplicationId: typedPayload.matchedLoanApplicationId ?? undefined,
  };
}

export function registerDefaultRealtimeEvents(registry: RealtimeEventRegistry): void {
  registry.register(RealtimeEventTypeEnum.NotificationCreated, validateNotificationCreatedEvent);
  registry.register(RealtimeEventTypeEnum.LoanStatusChanged, validateLoanStatusChangedEvent);
  registry.register(RealtimeEventTypeEnum.LoanOfferUpdated, validateLoanOfferUpdatedEvent);
}
