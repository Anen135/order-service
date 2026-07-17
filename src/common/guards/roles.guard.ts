import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '../../users/role.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // роли не заданы — доступ разрешён любому аутентифицированному пользователю
    }

    const { user } = context.switchToHttp().getRequest();
    const hasRole = user?.roles?.some((role: Role) => requiredRoles.includes(role));

    if (!hasRole) {
      throw new ForbiddenException('Недостаточно прав для выполнения действия');
    }
    return true;
  }
}
