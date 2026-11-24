import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendMessageDto {
  @ApiProperty({ example: 'Hey Ananya! Loved your take on classical music. Which violin piece is your favorite?' })
  @IsString()
  @IsNotEmpty()
  bodyText: string;

  @ApiPropertyOptional({ example: 'voice-note-uuid-ref' })
  @IsOptional()
  @IsString()
  mediaRefId?: string;
}
