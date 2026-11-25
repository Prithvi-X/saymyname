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
import { VoiceNotePresignDto, CallInviteDto, CallRespondDto, SendVoiceNoteDto } from './dto/calling.dto';

@ApiTags('Calling & Voice Notes (Phase 4)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, EligibilityGuard)
@Controller('calling')
export class CallingController {
  constructor(private readonly callingService: CallingService) {}

  @Post('voice-notes/presign')
  @ApiOperation({ summary: 'Pre-sign a voice note upload URL (max 60 seconds)' })
  async presignVoiceNote(@Request() req: any, @Body() dto: VoiceNotePresignDto) {
    return this.callingService.presignVoiceNote(req.user?.sub ?? req.user?.id, dto);
  }

  @Post('voice-notes/send')
  @ApiOperation({ summary: 'Send a voice note message to conversation' })
  async sendVoiceNote(@Request() req: any, @Body() dto: SendVoiceNoteDto) {
    return this.callingService.sendVoiceNote(req.user?.sub ?? req.user?.id, dto);
  }

  @Post('invite')
  @ApiOperation({ summary: 'Initiate 1:1 LiveKit audio/video call invitation' })
  async inviteCall(@Request() req: any, @Body() dto: CallInviteDto) {
    return this.callingService.inviteCall(req.user?.sub ?? req.user?.id, dto);
  }

  @Post('call-sessions/invite')
  @ApiOperation({ summary: 'Initiate 1:1 LiveKit audio/video call invitation (alias)' })
  async inviteCallAlias(@Request() req: any, @Body() dto: CallInviteDto) {
    return this.callingService.inviteCall(req.user?.sub ?? req.user?.id, dto);
  }

  @Post(':callId/respond')
  @ApiOperation({ summary: 'Respond to call invitation (accept, decline, busy)' })
  async respondToCall(
    @Request() req: any,
    @Param('callId') callId: string,
    @Body() dto: CallRespondDto,
  ) {
    return this.callingService.respondToCall(req.user?.sub ?? req.user?.id, callId, dto);
  }

  @Post(':callId/end')
  @ApiOperation({ summary: 'Hang up and terminate active call' })
  async endCall(@Request() req: any, @Param('callId') callId: string) {
    return this.callingService.endCall(req.user?.sub ?? req.user?.id, callId);
  }

  @Get(':callId')
  @ApiOperation({ summary: 'Get call session details' })
  async getCallSession(@Request() req: any, @Param('callId') callId: string) {
    return this.callingService.getCallSession(req.user?.sub ?? req.user?.id, callId);
  }
}
