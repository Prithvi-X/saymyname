import {
  Controller,
  Get,
  Head,
  Post,
  Body,
  Param,
  Query,
  Headers,
  ParseUUIDPipe,
  UseGuards,
  Req,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MessagingService } from './messaging.service';
import {
  MessagesQueryDto,
  MessagingVoiceNotePresignDto,
  SendMessageDto,
  SendMessagingVoiceNoteDto,
  SequenceAckDto,
} from './dto/messaging.dto';
import {
  JwtAuthGuard,
  AuthenticatedRequest,
} from '../identity/guards/jwt-auth.guard';
import { EligibilityGuard } from '../identity/guards/eligibility.guard';

@ApiTags('Private Messaging (1:1 Active Matches)')
@Controller('messaging')
@UseGuards(JwtAuthGuard, EligibilityGuard)
@ApiBearerAuth()
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Post('realtime/ticket')
  @ApiOperation({
    summary: 'Issue a single-use short-lived WebSocket connection ticket',
  })
  issueRealtimeTicket(@Req() req: AuthenticatedRequest) {
    return this.messagingService.createRealtimeTicket(req.user.sub);
  }

  @Get('conversations')
  @ApiOperation({
    summary: 'List active conversations with hydrated partner profiles & personal unread count',
  })
  getConversations(@Req() req: AuthenticatedRequest) {
    return this.messagingService.getConversations(req.user.sub);
  }

  @Get('conversations/:id/messages')
  @ApiOperation({
    summary: 'Get chronologically ordered message list for conversation',
  })
  getMessages(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Query() query: MessagesQueryDto,
  ) {
    return this.messagingService.getMessages(
      req.user.sub,
      conversationId,
      query,
    );
  }

  @Get('conversations/:id/history')
  @ApiOperation({
    summary: 'Get paginated message history with cursors and reconnect reconciliation metadata',
  })
  getMessageHistory(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Query() query: MessagesQueryDto,
  ) {
    return this.messagingService.getMessageHistory(
      req.user.sub,
      conversationId,
      query,
    );
  }

  @Post('conversations/:id/messages')
  @ApiOperation({ summary: 'Send private 1:1 text message to matched partner' })
  sendMessage(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Body() dto: SendMessageDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.messagingService.sendMessage(
      req.user.sub,
      conversationId,
      dto,
      idempotencyKey,
    );
  }

  @Post('conversations/:id/inbox-seen')
  @ApiOperation({
    summary: 'Advance caller own inbox unread cursor (no partner read receipt emitted)',
  })
  markInboxSeen(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Body() dto: SequenceAckDto,
  ) {
    return this.messagingService.markInboxSeen(
      req.user.sub,
      conversationId,
      dto,
    );
  }

  @Post('conversations/:id/delivery-ack')
  @ApiOperation({
    summary: 'Confirm recipient delivery up to sequence number (transitions Sent -> Delivered)',
  })
  ackDelivery(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Body() dto: SequenceAckDto,
  ) {
    return this.messagingService.ackDelivery(req.user.sub, conversationId, dto);
  }

  @Post('conversations/:id/voice-notes/presign')
  @ApiOperation({
    summary: 'Presign private R2 voice-note upload URL inside active conversation',
  })
  presignVoiceNote(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Body() dto: MessagingVoiceNotePresignDto,
  ) {
    return this.messagingService.presignVoiceNoteForConversation(
      req.user.sub,
      conversationId,
      dto,
    );
  }

  @Post('conversations/:id/voice-notes')
  @ApiOperation({
    summary: 'Verify uploaded audio binary & persist voice-note message in conversation',
  })
  sendVoiceNote(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Body() dto: SendMessagingVoiceNoteDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.messagingService.sendVoiceNoteToConversation(
      req.user.sub,
      conversationId,
      dto,
      idempotencyKey,
    );
  }

  @Get('media/:mediaId/url')
  @ApiOperation({
    summary: 'Get authenticated same-origin streaming URL descriptor for voice-note media',
  })
  getAuthorizedMediaUrl(
    @Req() req: AuthenticatedRequest,
    @Param('mediaId', ParseUUIDPipe) mediaId: string,
  ) {
    return this.messagingService.getAuthorizedMediaUrl(req.user.sub, mediaId);
  }

  @Get('media/:mediaId/stream')
  @ApiOperation({
    summary: 'Stream authorized voice-note audio bytes with HTTP Range support',
  })
  streamVoiceNoteMedia(
    @Req() req: AuthenticatedRequest,
    @Res() res: any,
    @Param('mediaId', ParseUUIDPipe) mediaId: string,
  ) {
    return this.messagingService.streamVoiceNoteMedia(req.user.sub, mediaId, req as any, res);
  }

  @Head('media/:mediaId/stream')
  @ApiOperation({
    summary: 'Head request for authorized voice-note audio metadata & Range readiness',
  })
  headVoiceNoteMedia(
    @Req() req: AuthenticatedRequest,
    @Res() res: any,
    @Param('mediaId', ParseUUIDPipe) mediaId: string,
  ) {
    return this.messagingService.streamVoiceNoteMedia(req.user.sub, mediaId, req as any, res);
  }
}
