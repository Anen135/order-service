import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './user.entity';
import { Role } from './role.enum';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly usersRepo: Repository<User>) {}

  async create(email: string, password: string, fullName: string, roles: Role[] = [Role.VIEWER]) {
    const existing = await this.usersRepo.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException('Пользователь с таким email уже существует');
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = this.usersRepo.create({ email, passwordHash, fullName, roles });
    return this.usersRepo.save(user);
  }

  async findByEmail(email: string) {
    return this.usersRepo.findOne({ where: { email } });
  }

  async findById(id: string) {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Пользователь не найден');
    return user;
  }

  async validateCredentials(email: string, password: string) {
    const user = await this.findByEmail(email);
    if (!user || !user.isActive) return null;
    const valid = await bcrypt.compare(password, user.passwordHash);
    return valid ? user : null;
  }
}
