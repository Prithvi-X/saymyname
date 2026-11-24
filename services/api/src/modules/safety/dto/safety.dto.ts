import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BlockUserDto {
  @ApiProperty({ example: 'a1111111-1111-1111-1111-111111111111', description: 'Account ID to block' })
  @IsString()
  @IsNotEmpty()
  blockedId: string;

  @ApiPropertyOptional({ example: 'Unwanted interaction' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ReportUserDto {
  @ApiProperty({ example: 'a1111111-1111-1111-1111-111111111111', description: 'Reported Account ID' })
  @IsString()
  @IsNotEmpty()
  reportedId: string;

  @ApiProperty({
    example: 'harassment',
    enum: ['harassment', 'inappropriate_content', 'underage_suspected', 'fake_profile', 'spam', 'offline_safety'],
  })
  @IsString()
  @IsNotEmpty()
  reportCategory: string;

  @ApiPropertyOptional({ example: 'Sent unsolicited inappropriate messages.' })
  @IsOptional()
  @IsString()
  description?: string;
}
