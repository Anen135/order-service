import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const user = await this.usersService.create(dto.email, dto.password, dto.fullName, dto.roles);
    return this.buildToken(user.id, user.email, user.roles);
  }

  async login(email: string, password: string) {
    const user = await this.usersService.validateCredentials(email, password);
    if (!user) {
      throw new UnauthorizedException('Неверный email или пароль');
    }
    return this.buildToken(user.id, user.email, user.roles);
  }

  private buildToken(sub: string, email: string, roles: string[]) {
    const accessToken = this.jwtService.sign({ sub, email, roles });
    return { accessToken, tokenType: 'Bearer' };
  }
}
