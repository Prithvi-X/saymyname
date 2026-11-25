import { IsString, IsNotEmpty, IsOptional, IsUUID, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class DiscoveryFeedQueryDto {
  @ApiPropertyOptional({ description: 'Opaque HMAC-signed cursor token from previous discovery batch' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ example: 10, description: 'Batch page size (default 10, max 20)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}

export class LikeCandidateDto {
  @ApiPropertyOptional({
    example: 'b0000000-0000-0000-0000-000000000002',
    description: 'Opaque profileId of the candidate being liked (preferred)',
  })
  @IsOptional()
  @IsUUID()
  targetProfileId?: string;

  @ApiPropertyOptional({
    example: 'b0000000-0000-0000-0000-000000000002',
    description: 'Legacy account ID fallback (prefer targetProfileId)',
  })
  @IsOptional()
  @IsString()
  toAccountId?: string;
}

export class PassCandidateDto {
  @ApiPropertyOptional({
    example: 'b0000000-0000-0000-0000-000000000002',
    description: 'Opaque profileId of the candidate being passed (preferred)',
  })
  @IsOptional()
  @IsUUID()
  targetProfileId?: string;

  @ApiPropertyOptional({
    example: 'b0000000-0000-0000-0000-000000000002',
    description: 'Legacy account ID fallback (prefer targetProfileId)',
  })
  @IsOptional()
  @IsString()
  toAccountId?: string;
}

export class UnmatchDto {
  @ApiPropertyOptional({ example: 'm0000000-0000-0000-0000-000000000001', description: 'Match ID to unpair' })
  @IsString()
  @IsNotEmpty()
  matchId: string;

  @ApiPropertyOptional({ example: 'Different communication preferences' })
  @IsOptional()
  @IsString()
  reason?: string;
}
