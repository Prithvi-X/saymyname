import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LikeCandidateDto {
  @ApiProperty({ example: 'b0000000-0000-0000-0000-000000000002', description: 'Account ID of the candidate being liked' })
  @IsString()
  @IsNotEmpty()
  toAccountId: string;
}

export class PassCandidateDto {
  @ApiProperty({ example: 'b0000000-0000-0000-0000-000000000002', description: 'Account ID of the candidate being passed' })
  @IsString()
  @IsNotEmpty()
  toAccountId: string;
}

export class UnmatchDto {
  @ApiProperty({ example: 'm0000000-0000-0000-0000-000000000001', description: 'Match ID to unpair' })
  @IsString()
  @IsNotEmpty()
  matchId: string;

  @ApiPropertyOptional({ example: 'Different communication preferences' })
  @IsOptional()
  @IsString()
  reason?: string;
}
