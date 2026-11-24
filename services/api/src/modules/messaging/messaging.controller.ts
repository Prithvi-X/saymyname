import { Controller, Get, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MessagingService } from './messaging.service';
import { SendMessageDto } from './dto/messaging.dto';
import { JwtAuthGuard, AuthenticatedRequest } from '../identity/guards/jwt-auth.guard';
import { EligibilityGuard } from '../identity/guards/eligibility.guard';

@ApiTags('Private Messaging (1:1 Active Matches)')
@Controller('messaging')
@UseGuards(JwtAuthGuard, EligibilityGuard)
@ApiBearerAuth()
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Get('conversations')
  @ApiOperation({ summary: 'List user active conversations with matched partners' })
  getConversations(@Req() req: AuthenticatedRequest) {
    return this.messagingService.getConversations(req.user.sub);
  }

  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'Get chronologically ordered message history for conversation' })
  getMessages(@Req() req: AuthenticatedRequest, @Param('id') conversationId: string) {
    return this.messagingService.getMessages(req.user.sub, conversationId);
  }

  @Post('conversations/:id/messages')
  @ApiOperation({ summary: 'Send private 1:1 message to matched partner' })
  sendMessage(
    @Req() req: AuthenticatedRequest,
    @Param('id') conversationId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.messagingService.sendMessage(req.user.sub, conversationId, dto);
  }
}
