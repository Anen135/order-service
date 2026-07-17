import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from '../../users/role.enum';

export class RegisterDto {
  @ApiProperty({ example: 'manager@shop.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'StrongPass123' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'Иван Иванов' })
  @IsString()
  fullName: string;

  @ApiProperty({ enum: Role, isArray: true, required: false, default: [Role.VIEWER] })
  @IsOptional()
  @IsArray()
  @IsEnum(Role, { each: true })
  roles?: Role[];
}
