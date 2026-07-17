import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNumber, IsOptional, IsPositive, IsString, Min, ValidateNested } from 'class-validator';

export class CreateOrderItemDto {
  @ApiProperty({ example: 'Клавиатура механическая' })
  @IsString()
  productName: string;

  @ApiProperty({ example: 2 })
  @IsNumber()
  @IsPositive()
  quantity: number;

  @ApiProperty({ example: 4990.0 })
  @IsNumber()
  @Min(0)
  price: number;
}

export class CreateOrderDto {
  @ApiProperty({ example: 'Иван Петров' })
  @IsString()
  customerName: string;

  @ApiProperty({ type: [CreateOrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  @ApiProperty({ required: false, example: 'Позвонить перед доставкой' })
  @IsOptional()
  @IsString()
  comment?: string;
}
