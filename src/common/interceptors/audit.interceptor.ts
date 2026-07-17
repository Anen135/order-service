import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { AuditService } from '../../audit/audit.service';
import { AUDIT_ACTION_KEY } from '../decorators/audit.decorator';

const MUTATING_METHODS = ['POST', 'PATCH', 'PUT', 'DELETE'];
const SENSITIVE_FIELDS = ['password', 'passwordHash', 'accessToken'];

function sanitize(obj: any) {
  if (!obj || typeof obj !== 'object') return obj;
  const clone: any = Array.isArray(obj) ? [...obj] : { ...obj };
  for (const key of Object.keys(clone)) {
    if (SENSITIVE_FIELDS.includes(key)) clone[key] = '***';
  }
  return clone;
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly auditService: AuditService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, originalUrl, body, ip, user, params } = request;

    if (!MUTATING_METHODS.includes(method)) {
      return next.handle();
    }

    const customAction = this.reflector.get<string>(AUDIT_ACTION_KEY, context.getHandler());
    const controllerName = context.getClass().name.replace('Controller', '');
    const action = customAction ?? `${controllerName.toUpperCase()}_${method}`;
    const entityId = params?.id ?? null;

    return next.handle().pipe(
      tap((response) => {
        this.auditService.record({
          userId: user?.id ?? null,
          userEmail: user?.email ?? null,
          action,
          entity: controllerName,
          entityId: entityId ?? response?.id ?? null,
          method,
          path: originalUrl,
          requestBody: sanitize(body),
          responseSnapshot: sanitize(response),
          ip,
          success: true,
        });
      }),
      catchError((err) => {
        this.auditService.record({
          userId: user?.id ?? null,
          userEmail: user?.email ?? null,
          action,
          entity: controllerName,
          entityId,
          method,
          path: originalUrl,
          requestBody: sanitize(body),
          responseSnapshot: null,
          ip,
          success: false,
          errorMessage: err?.message ?? 'Unknown error',
        });
        return throwError(() => err);
      }),
    );
  }
}
