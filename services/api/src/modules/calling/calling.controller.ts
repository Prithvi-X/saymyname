import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../identity/guards/jwt-auth.guard';
import { EligibilityGuard } from '../identity/guards/eligibility.guard';
import { CallingService } from './calling.service';
import {
  VoiceNotePresignDto,
  CallInviteDto,
  CallRespondDto,
  CallStateTransitionDto,
  SendVoiceNoteDto,
} from './dto/calling.dto';

@ApiTags('Calling (Phase 4.1 Audio-Only)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, EligibilityGuard)
@Controller('calling')
export class CallingController {
  constructor(private readonly callingService: CallingService) {}

  @Post('voice-notes/presign')
  @ApiOperation({ summary: 'Pre-sign a voice note upload URL (deprecated legacy endpoint)' })
  async presignVoiceNote(@Request() req: any, @Body() dto: VoiceNotePresignDto) {
    return this.callingService.presignVoiceNote(req.user?.sub ?? req.user?.id, dto);
  }

  @Post('voice-notes/send')
  @ApiOperation({ summary: 'Send a voice note message (deprecated legacy endpoint)' })
  async sendVoiceNote(@Request() req: any, @Body() dto: SendVoiceNoteDto) {
    return this.callingService.sendVoiceNote(req.user?.sub ?? req.user?.id, dto);
  }

  @Post('invite')
  @ApiOperation({ summary: 'Initiate 1:1 LiveKit audio-only call invitation' })
  async inviteCall(@Request() req: any, @Body() dto: CallInviteDto) {
    return this.callingService.inviteCall(req.user?.sub ?? req.user?.id, dto);
  }

  @Post('call-sessions/invite')
  @ApiOperation({ summary: 'Initiate 1:1 LiveKit audio-only call invitation (alias)' })
  async inviteCallAlias(@Request() req: any, @Body() dto: CallInviteDto) {
    return this.callingService.inviteCall(req.user?.sub ?? req.user?.id, dto);
  }

  @Get('conversations/:conversationId/active')
  @ApiOperation({ summary: 'Get active or ringing call session for a conversation' })
  async getActiveCall(
    @Request() req: any,
    @Param('conversationId') conversationId: string,
  ) {
    return this.callingService.getActiveCallForConversation(
      req.user?.sub ?? req.user?.id,
      conversationId,
    );
  }

  @Post(':callId/respond')
  @ApiOperation({ summary: 'Respond to call invitation (accept, decline, busy, cancel)' })
  async respondToCall(
    @Request() req: any,
    @Param('callId') callId: string,
    @Body() dto: CallRespondDto,
  ) {
    return this.callingService.respondToCall(req.user?.sub ?? req.user?.id, callId, dto);
  }

  @Post(':callId/token')
  @ApiOperation({ summary: 'Issue fresh short-lived audio-only LiveKit token for accepted/active call' })
  async issueJoinToken(@Request() req: any, @Param('callId') callId: string) {
    return this.callingService.issueJoinToken(req.user?.sub ?? req.user?.id, callId);
  }

  @Post(':callId/state')
  @ApiOperation({ summary: 'Update non-terminal call connection state (ringing, connecting, active, reconnecting)' })
  async updateCallState(
    @Request() req: any,
    @Param('callId') callId: string,
    @Body() dto: CallStateTransitionDto,
  ) {
    return this.callingService.updateCallState(req.user?.sub ?? req.user?.id, callId, dto);
  }

  @Post(':callId/end')
  @ApiOperation({ summary: 'Hang up and terminate active or ringing call' })
  async endCall(@Request() req: any, @Param('callId') callId: string) {
    return this.callingService.endCall(req.user?.sub ?? req.user?.id, callId);
  }

  @Get(':callId')
  @ApiOperation({ summary: 'Get call session details' })
  async getCallSession(@Request() req: any, @Param('callId') callId: string) {
    return this.callingService.getCallSession(req.user?.sub ?? req.user?.id, callId);
  }
}
