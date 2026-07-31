export type AppErrorCode =
  | 'VALIDATION_ERROR'
  | 'CONNECTION_ERROR'
  | 'UNSUPPORTED_CONNECTION'
  | 'PRINT_ERROR'
  | 'UNKNOWN_ERROR';

export interface AppError {
  code: AppErrorCode;
  message: string;
  cause?: unknown;
}

export class AppErrorException extends Error {
  code: AppErrorCode;
  cause?: unknown;

  constructor(error: AppError) {
    super(error.message);
    this.name = 'AppErrorException';
    this.code = error.code;
    this.cause = error.cause;
  }
}
