import { IsString, IsNotEmpty, IsInt, Min, Max, IsIn, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class VoiceNotePresignDto {
  @ApiProperty({ example: 'note_123.m4a', description: 'Original filename' })
  @IsString()
  @IsNotEmpty()
  filename!: string;

  @ApiProperty({ example: 'audio/m4a', description: 'Audio MIME type (m4a, mp3, webm, ogg)' })
  @IsString()
  @IsNotEmpty()
  mimeType!: string;

  @ApiProperty({ example: 45, description: 'Duration in seconds (max 60)' })
  @IsInt()
  @Min(1)
  @Max(60)
  durationSeconds!: number;
}

export class CallInviteDto {
  @ApiProperty({ example: 'c1111111-1111-1111-1111-111111111111', description: 'Conversation UUID' })
  @IsString()
  @IsNotEmpty()
  conversationId!: string;
}

export class CallRespondDto {
  @ApiProperty({ example: 'accept', enum: ['accept', 'decline', 'busy'], description: 'Response action' })
  @IsString()
  @IsIn(['accept', 'decline', 'busy'])
  action!: 'accept' | 'decline' | 'busy';
}

export class SendVoiceNoteDto {
  @ApiProperty({ example: 'c1111111-1111-1111-1111-111111111111', description: 'Conversation UUID' })
  @IsString()
  @IsNotEmpty()
  conversationId!: string;

  @ApiProperty({ example: 'm1111111-1111-1111-1111-111111111111', description: 'Media Reference UUID from presign' })
  @IsString()
  @IsNotEmpty()
  mediaRefId!: string;

  @ApiProperty({ example: 32, description: 'Duration in seconds (max 60)' })
  @IsInt()
  @Min(1)
  @Max(60)
  durationSeconds!: number;

  @ApiPropertyOptional({ example: 'Hey, checking in after the algorithms quiz!', description: 'Optional voice note note/caption' })
  @IsString()
  @IsOptional()
  bodyText?: string;
}
