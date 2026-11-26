import { IsString, IsNotEmpty, IsOptional, IsUUID, IsIn, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const ALLOWED_REPORT_CATEGORIES = [
  'harassment',
  'inappropriate_content',
  'underage_suspected',
  'fake_profile',
  'spam',
  'offline_safety',
] as const;

export class BlockUserDto {
  @ApiPropertyOptional({
    example: 'a1111111-1111-1111-1111-111111111111',
    description: 'Opaque target profileId (preferred from Discover/Profile UI)',
  })
  @IsOptional()
  @IsUUID()
  targetProfileId?: string;

  @ApiPropertyOptional({
    example: 'a1111111-1111-1111-1111-111111111111',
    description: 'Target accountId (for match/admin contexts)',
  })
  @IsOptional()
  @IsString()
  blockedId?: string;

  @ApiPropertyOptional({ example: 'Unwanted interaction' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class ReportUserDto {
  @ApiPropertyOptional({
    example: 'a1111111-1111-1111-1111-111111111111',
    description: 'Opaque reported target profileId (preferred from Discover/Profile UI)',
  })
  @IsOptional()
  @IsUUID()
  targetProfileId?: string;

  @ApiPropertyOptional({
    example: 'a1111111-1111-1111-1111-111111111111',
    description: 'Reported accountId',
  })
  @IsOptional()
  @IsString()
  reportedId?: string;

  @ApiProperty({
    example: 'harassment',
    enum: ALLOWED_REPORT_CATEGORIES,
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(ALLOWED_REPORT_CATEGORIES)
  reportCategory: string;

  @ApiPropertyOptional({ example: 'Sent unsolicited inappropriate messages.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ description: 'Optional conversation UUID when reporting chat behavior' })
  @IsOptional()
  @IsUUID()
  conversationId?: string;

  @ApiPropertyOptional({ description: 'Optional message or voice-note UUID attached to report context' })
  @IsOptional()
  @IsUUID()
  messageId?: string;
}
