import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request & { requestId?: string }>();
    const response = http.getResponse<Response>();
    const requestId = (request.headers['x-request-id'] as string) || randomUUID();
    request.requestId = requestId;
    response.setHeader('x-request-id', requestId);

    const started = Date.now();
    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.log(
            `${request.method} ${request.url} ${response.statusCode} ${Date.now() - started}ms requestId=${requestId}`,
          );
        },
        error: () => {
          this.logger.warn(
            `${request.method} ${request.url} ERROR ${Date.now() - started}ms requestId=${requestId}`,
          );
        },
      }),
    );
  }
}
