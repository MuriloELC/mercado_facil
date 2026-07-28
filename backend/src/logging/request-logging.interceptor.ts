import {
  CallHandler,
  ExecutionContext,
  Injectable,
  HttpException,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { randomUUID } from 'crypto';
import { AppLogger } from './app.logger';

type RequestUser = {
  userId?: string;
  role?: string;
};

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: AppLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const startedAt = Date.now();
    const http = context.switchToHttp();
    const request = http.getRequest<{
      method: string;
      originalUrl?: string;
      url: string;
      user?: RequestUser;
      ip?: string;
      headers?: Record<string, string>;
    }>();
    const response = http.getResponse<{ statusCode?: number }>();

    const requestId = request.headers?.['x-request-id'] ?? randomUUID();
    const path = request.originalUrl ?? request.url;

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.log('request.completed', 'HTTP', {
            requestId,
            method: request.method,
            path,
            statusCode: response.statusCode,
            durationMs: Date.now() - startedAt,
            userId: request.user?.userId ?? null,
            role: request.user?.role ?? null,
            ip: request.ip ?? null,
          });
        },
        error: (error) => {
          const statusCode =
            error instanceof HttpException ? error.getStatus() : 500;

          this.logger.error('request.failed', error?.stack, 'HTTP', {
            requestId,
            method: request.method,
            path,
            statusCode,
            durationMs: Date.now() - startedAt,
            userId: request.user?.userId ?? null,
            role: request.user?.role ?? null,
            ip: request.ip ?? null,
            error: error?.message ?? 'unknown',
          });
        },
      }),
    );
  }
}
