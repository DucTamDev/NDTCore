type LogLevel = 'debug' | 'info' | 'warning' | 'error';

class LoggerServiceImpl {
  private write(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    if (!__DEV__) return;
    const consoleMethod = level === 'warning' ? 'warn' : level;
    console[consoleMethod](`[${level.toUpperCase()}] ${message}`, meta ?? '');
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.write('debug', message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.write('info', message, meta);
  }

  warning(message: string, meta?: Record<string, unknown>): void {
    this.write('warning', message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.write('error', message, meta);
  }
}

export const LoggerService = new LoggerServiceImpl();
