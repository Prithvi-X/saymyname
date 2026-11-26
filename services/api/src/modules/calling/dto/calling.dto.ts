import { IsString, IsNotEmpty, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CallInviteDto {
  @ApiProperty({ example: 'c1111111-1111-1111-1111-111111111111', description: 'Conversation UUID' })
  @IsString()
  @IsNotEmpty()
  conversationId!: string;
}

export class CallRespondDto {
  @ApiProperty({ example: 'accept', enum: ['accept', 'decline', 'busy', 'cancel'], description: 'Response action' })
  @IsString()
  @IsIn(['accept', 'decline', 'busy', 'cancel'])
  action!: 'accept' | 'decline' | 'busy' | 'cancel';
}

export class CallStateTransitionDto {
  @ApiProperty({ example: 'active', enum: ['ringing', 'connecting', 'active', 'reconnecting'], description: 'Target non-terminal state' })
  @IsString()
  @IsIn(['ringing', 'connecting', 'active', 'reconnecting'])
  state!: 'ringing' | 'connecting' | 'active' | 'reconnecting';
}
