import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  IsUUID,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  MAX_TEXT_MESSAGE_LENGTH,
  VOICE_NOTE_MAX_DURATION_SEC,
} from '@saymyname/validation';

export class SendMessageDto {
  @ApiProperty({
    example: 'Hey Ananya! Loved your take on classical music.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_TEXT_MESSAGE_LENGTH)
  bodyText!: string;

  @ApiPropertyOptional({
    example: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
    description: 'Client-generated UUID for strict idempotent retries',
  })
  @IsOptional()
  @IsUUID()
  clientAssignedUuid?: string;

  @ApiPropertyOptional({ example: 'voice-note-uuid-ref' })
  @IsOptional()
  @IsString()
  mediaRefId?: string;
}

export class MessagesQueryDto {
  @ApiPropertyOptional({
    description: 'Fetch messages strictly before this sequence number (older history cursor)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  beforeSeq?: number;

  @ApiPropertyOptional({
    description: 'Fetch messages strictly after this sequence number (reconnect delta)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  afterSeq?: number;

  @ApiPropertyOptional({ default: 30, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class SequenceAckDto {
  @ApiProperty({ example: 12, description: 'Highest message sequence number acknowledged' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  upToSequenceNo!: number;
}

export class MessagingVoiceNotePresignDto {
  @ApiProperty({ example: 'voice_note.webm' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  filename!: string;

  @ApiProperty({ example: 'audio/webm' })
  @IsString()
  @IsNotEmpty()
  mimeType!: string;

  @ApiProperty({ example: 18, minimum: 1, maximum: VOICE_NOTE_MAX_DURATION_SEC })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(VOICE_NOTE_MAX_DURATION_SEC)
  durationSeconds!: number;

  @ApiPropertyOptional({ example: 142000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(64)
  @Max(15 * 1024 * 1024)
  fileSizeBytes?: number;
}

export class SendMessagingVoiceNoteDto {
  @ApiProperty({ example: 'a1111111-1111-1111-1111-111111111111' })
  @IsUUID()
  mediaRefId!: string;

  @ApiProperty({ description: 'Signed presign uploadToken issued by the server' })
  @IsString()
  @IsNotEmpty()
  uploadToken!: string;

  @ApiPropertyOptional({ example: 18 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(VOICE_NOTE_MAX_DURATION_SEC)
  durationSeconds?: number;

  @ApiPropertyOptional({ example: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d' })
  @IsOptional()
  @IsUUID()
  clientAssignedUuid?: string;
}
