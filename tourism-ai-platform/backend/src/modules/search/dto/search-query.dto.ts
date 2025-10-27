import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class SearchQueryDto {
  @ApiProperty({ description: 'Term to look up across tenant search index', example: 'dental' })
  @IsString()
  @IsNotEmpty()
  q!: string;
}
