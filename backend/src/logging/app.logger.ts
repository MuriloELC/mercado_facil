import { ConsoleLogger, Injectable, LogLevel } from '@nestjs/common';
import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, isAbsolute, resolve } from 'path';

type LogMeta = Record<string, unknown>;

@Injectable()
export class AppLogger extends ConsoleLogger {
  private readonly logFilePath: string;

  constructor() {
    const levels = (process.env.LOG_LEVELS?.split(',').map((l) => l.trim()) ?? [
      'log',
      'error',
      'warn',
      'debug',
    ]) as LogLevel[];

    super('App', {
      timestamp: true,
      logLevels: levels,
    });

    const configuredPath = process.env.LOG_FILE_PATH ?? 'logs/backend.log';
    this.logFilePath = isAbsolute(configuredPath)
      ? configuredPath
      : resolve(process.cwd(), configuredPath);

    const dir = dirname(this.logFilePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  log(message: unknown, context?: string, meta?: LogMeta): void {
    this.writeJson('log', message, context, meta);
  }

  error(message: unknown, trace?: string, context?: string, meta?: LogMeta): void {
    this.writeJson('error', message, context, { trace, ...meta });
  }

  warn(message: unknown, context?: string, meta?: LogMeta): void {
    this.writeJson('warn', message, context, meta);
  }

  debug(message: unknown, context?: string, meta?: LogMeta): void {
    this.writeJson('debug', message, context, meta);
  }

  private writeJson(
    level: 'log' | 'error' | 'warn' | 'debug',
    message: unknown,
    context?: string,
    meta?: LogMeta,
  ): void {
    const payload = {
      ts: new Date().toISOString(),
      level,
      context: context ?? this.context,
      message: typeof message === 'string' ? message : JSON.stringify(message),
      ...meta,
    };

    const line = JSON.stringify(payload);

    try {
      appendFileSync(this.logFilePath, `${line}\n`, { encoding: 'utf8' });
    } catch {
      // ignore file write failures and keep console output
    }

    if (level === 'error') {
      // eslint-disable-next-line no-console
      console.error(line);
      return;
    }

    // eslint-disable-next-line no-console
    console.log(line);
  }
}
