/**
 * Erros da aplicação — SPEC-002 §1 (formato uniforme de erro).
 * NFR-S10: o corpo da resposta nunca carrega stack trace.
 */

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'INVALID_CREDENTIALS'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'ROOM_INACTIVE'
  | 'ROOM_UNAVAILABLE'
  | 'ALREADY_CANCELLED'
  | 'DUPLICATE_CODE'
  | 'QUOTA_EXCEEDED'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  INVALID_CREDENTIALS: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  ROOM_INACTIVE: 409,
  ROOM_UNAVAILABLE: 409,
  ALREADY_CANCELLED: 409,
  DUPLICATE_CODE: 409,
  QUOTA_EXCEEDED: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly details: string[];

  constructor(code: ErrorCode, message: string, details: string[] = []) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = STATUS_BY_CODE[code];
    this.details = details;
  }
}

export function errorBody(code: ErrorCode, message: string, details: string[] = []) {
  return { error: { code, message, details } };
}
