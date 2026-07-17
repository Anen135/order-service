import { SetMetadata } from '@nestjs/common';

export const AUDIT_ACTION_KEY = 'audit_action';

/**
 * Помечает метод контроллера явным названием действия для аудита
 * (например 'ORDER_STATUS_CHANGE'). Если декоратор не применён,
 * AuditInterceptor всё равно логирует мутирующие HTTP-методы,
 * но с автогенерированным именем действия.
 */
export const AuditAction = (action: string) => SetMetadata(AUDIT_ACTION_KEY, action);
