import { IsString, IsNotEmpty, IsIn, IsOptional, IsObject, IsISO8601, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GameInviteDto {
  @ApiProperty({ example: 'c1111111-1111-1111-1111-111111111111', description: 'Conversation UUID' })
  @IsString()
  @IsNotEmpty()
  conversationId!: string;

  @ApiProperty({ example: 'word_scramble', enum: ['word_scramble', 'iitm_trivia', 'twenty_questions'] })
  @IsString()
  @IsIn(['word_scramble', 'iitm_trivia', 'twenty_questions'])
  gameKey!: string;
}

export class GameRespondDto {
  @ApiProperty({ example: 'accept', enum: ['accept', 'decline'] })
  @IsString()
  @IsIn(['accept', 'decline'])
  action!: 'accept' | 'decline';
}

export class GameMoveDto {
  @ApiProperty({ example: 'guess_word', description: 'Type of game move (e.g., guess_word, submit_trivia, answer_prompt)' })
  @IsString()
  @IsNotEmpty()
  moveType!: string;

  @ApiProperty({ example: { guess: 'ALGORITHM' }, description: 'Payload containing move parameters' })
  @IsObject()
  moveData!: Record<string, any>;
}

export class VirtualDateProposeDto {
  @ApiProperty({ example: 'c1111111-1111-1111-1111-111111111111', description: 'Conversation UUID' })
  @IsString()
  @IsNotEmpty()
  conversationId!: string;

  @ApiProperty({ example: '2026-12-01T18:30:00.000Z', description: 'Scheduled date and time in ISO 8601' })
  @IsISO8601()
  scheduledFor!: string;

  @ApiProperty({ example: 'Asia/Kolkata', description: 'IANA Timezone' })
  @IsString()
  @IsNotEmpty()
  timezone!: string;

  @ApiProperty({ example: 'study_session', enum: ['study_session', 'campus_walk', 'game_night', 'music_share', 'coffee_chat'] })
  @IsString()
  @IsNotEmpty()
  activityType!: string;

  @ApiPropertyOptional({ example: 'Let us prepare for the Deep Learning midterms together over audio call!', description: 'Notes or agenda' })
  @IsString()
  @IsOptional()
  @MaxLength(400)
  proposalNotes?: string;
}

export class VirtualDateRespondDto {
  @ApiProperty({ example: 'accept', enum: ['accept', 'cancel'] })
  @IsString()
  @IsIn(['accept', 'cancel'])
  action!: 'accept' | 'cancel';
}

export class RelationshipProposeDto {
  @ApiProperty({ example: 'm1111111-1111-1111-1111-111111111111', description: 'Active Match UUID' })
  @IsString()
  @IsNotEmpty()
  matchId!: string;
}

export class RelationshipRespondDto {
  @ApiProperty({ example: 'm1111111-1111-1111-1111-111111111111', description: 'Active Match UUID' })
  @IsString()
  @IsNotEmpty()
  matchId!: string;

  @ApiProperty({ example: 'accept', enum: ['accept', 'decline'] })
  @IsString()
  @IsIn(['accept', 'decline'])
  action!: 'accept' | 'decline';
}

export class RelationshipMilestoneDto {
  @ApiProperty({ example: 'First Virtual Date', description: 'Title of the milestone' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  @ApiProperty({ example: '2026-11-24', description: 'Date of milestone (YYYY-MM-DD)' })
  @IsString()
  @IsNotEmpty()
  milestoneDate!: string;

  @ApiPropertyOptional({ example: 'We talked for three hours about computer vision and childhood memories.', description: 'Description' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;
}

export class RelationshipJournalDto {
  @ApiProperty({ example: 'We cracked the Kaggle competition top 50 today together!', description: 'Private journal reflection' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1500)
  entryText!: string;

  @ApiProperty({ example: '2026-11-24', description: 'Date of memory (YYYY-MM-DD)' })
  @IsString()
  @IsNotEmpty()
  entryDate!: string;
}

export class RelationshipLeaveDto {
  @ApiProperty({ example: 'm1111111-1111-1111-1111-111111111111', description: 'Active Match UUID' })
  @IsString()
  @IsNotEmpty()
  matchId!: string;
}
