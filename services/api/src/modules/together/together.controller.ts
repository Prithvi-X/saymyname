import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../identity/guards/jwt-auth.guard';
import { EligibilityGuard } from '../identity/guards/eligibility.guard';
import { TogetherService } from './together.service';
import {
  GameInviteDto,
  GameRespondDto,
  GameMoveDto,
  VirtualDateProposeDto,
  VirtualDateRespondDto,
  RelationshipProposeDto,
  RelationshipRespondDto,
  RelationshipMilestoneDto,
  RelationshipJournalDto,
  RelationshipLeaveDto,
} from './dto/together.dto';

@ApiTags('Together Space & Relationship Mode (Phases 4-6)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, EligibilityGuard)
@Controller('together')
export class TogetherController {
  constructor(private readonly togetherService: TogetherService) {}

  // ==========================================
  // MINI-GAMES
  // ==========================================

  @Get('games')
  @ApiOperation({ summary: 'List interactive mini-games catalog' })
  getGameCatalog() {
    return this.togetherService.getGameCatalog();
  }

  @Get('games/sessions')
  @ApiOperation({ summary: 'List active, invited, and recent game sessions for a conversation' })
  async listGameSessions(@Request() req: any, @Query('conversationId') conversationId: string) {
    return this.togetherService.listGameSessions(req.user?.sub ?? req.user?.id, conversationId);
  }

  @Post('games/invite')
  @ApiOperation({ summary: 'Invite match partner to play a mini-game' })
  async inviteGame(@Request() req: any, @Body() dto: GameInviteDto) {
    return this.togetherService.inviteGame(req.user?.sub ?? req.user?.id, dto);
  }

  @Post('games/:sessionId/respond')
  @ApiOperation({ summary: 'Accept or decline game invitation' })
  async respondGame(
    @Request() req: any,
    @Param('sessionId') sessionId: string,
    @Body() dto: GameRespondDto,
  ) {
    return this.togetherService.respondGame(req.user?.sub ?? req.user?.id, sessionId, dto);
  }

  @Post('games/:sessionId/move')
  @ApiOperation({ summary: 'Submit interactive game move' })
  async submitMove(
    @Request() req: any,
    @Param('sessionId') sessionId: string,
    @Body() dto: GameMoveDto,
  ) {
    return this.togetherService.submitMove(req.user?.sub ?? req.user?.id, sessionId, dto);
  }

  @Post('games/:sessionId/end')
  @ApiOperation({ summary: 'End or withdraw from an active/invited game session' })
  async endGameSession(@Request() req: any, @Param('sessionId') sessionId: string) {
    return this.togetherService.endGameSession(req.user?.sub ?? req.user?.id, sessionId);
  }

  @Get('games/:sessionId')
  @ApiOperation({ summary: 'Get live game session status' })
  async getGameSession(@Request() req: any, @Param('sessionId') sessionId: string) {
    return this.togetherService.getGameSession(req.user?.sub ?? req.user?.id, sessionId);
  }

  // ==========================================
  // VIRTUAL DATES
  // ==========================================

  @Post('virtual-dates/propose')
  @ApiOperation({ summary: 'Propose a virtual date with specific time and activity' })
  async proposeVirtualDate(@Request() req: any, @Body() dto: VirtualDateProposeDto) {
    return this.togetherService.proposeVirtualDate(req.user?.sub ?? req.user?.id, dto);
  }

  @Post('virtual-dates/:dateId/respond')
  @ApiOperation({ summary: 'Accept or cancel virtual date' })
  async respondVirtualDate(
    @Request() req: any,
    @Param('dateId') dateId: string,
    @Body() dto: VirtualDateRespondDto,
  ) {
    return this.togetherService.respondVirtualDate(req.user?.sub ?? req.user?.id, dateId, dto);
  }

  @Get('virtual-dates')
  @ApiOperation({ summary: 'List virtual dates for a conversation' })
  async listVirtualDates(@Request() req: any, @Query('conversationId') conversationId: string) {
    return this.togetherService.listVirtualDates(req.user?.sub ?? req.user?.id, conversationId);
  }

  // ==========================================
  // RELATIONSHIP MODE (Dual-Opt-In & Independent Unpair)
  // ==========================================

  @Post('relationship/propose')
  @ApiOperation({ summary: 'Propose relationship mode (requires partner acceptance)' })
  async proposeRelationship(@Request() req: any, @Body() dto: RelationshipProposeDto) {
    return this.togetherService.proposeRelationship(req.user?.sub ?? req.user?.id, dto);
  }

  @Post('relationship/respond')
  @ApiOperation({ summary: 'Accept or decline relationship mode proposal' })
  async respondRelationship(@Request() req: any, @Body() dto: RelationshipRespondDto) {
    return this.togetherService.respondRelationship(req.user?.sub ?? req.user?.id, dto);
  }

  @Get('relationship/:matchId/status')
  @ApiOperation({ summary: 'Get relationship mode status (none/proposed/active/declined/disbanded)' })
  async getRelationshipStatus(@Request() req: any, @Param('matchId') matchId: string) {
    return this.togetherService.getRelationshipStatus(req.user?.sub ?? req.user?.id, matchId);
  }

  @Get('relationship/:matchId')
  @ApiOperation({ summary: 'Get active relationship space details and anniversary countdown' })
  async getRelationshipSpace(@Request() req: any, @Param('matchId') matchId: string) {
    return this.togetherService.getRelationshipSpace(req.user?.sub ?? req.user?.id, matchId);
  }

  @Post('relationship/:matchId/milestones')
  @ApiOperation({ summary: 'Add a shared milestone to relationship space' })
  async createMilestone(
    @Request() req: any,
    @Param('matchId') matchId: string,
    @Body() dto: RelationshipMilestoneDto,
  ) {
    return this.togetherService.createMilestone(req.user?.sub ?? req.user?.id, matchId, dto);
  }

  @Get('relationship/:matchId/milestones')
  @ApiOperation({ summary: 'List shared milestones' })
  async listMilestones(@Request() req: any, @Param('matchId') matchId: string) {
    return this.togetherService.listMilestones(req.user?.sub ?? req.user?.id, matchId);
  }

  @Post('relationship/:matchId/journal')
  @ApiOperation({ summary: 'Create private relationship journal entry' })
  async createJournalEntry(
    @Request() req: any,
    @Param('matchId') matchId: string,
    @Body() dto: RelationshipJournalDto,
  ) {
    return this.togetherService.createJournalEntry(req.user?.sub ?? req.user?.id, matchId, dto);
  }

  @Get('relationship/:matchId/journal')
  @ApiOperation({ summary: 'List private relationship journal entries' })
  async listJournalEntries(@Request() req: any, @Param('matchId') matchId: string) {
    return this.togetherService.listJournalEntries(req.user?.sub ?? req.user?.id, matchId);
  }

  @Post('relationship/leave')
  @ApiOperation({ summary: 'Unilaterally deactivate relationship mode (zero partner permission required)' })
  async leaveRelationship(@Request() req: any, @Body() dto: RelationshipLeaveDto) {
    return this.togetherService.leaveRelationship(req.user?.sub ?? req.user?.id, dto);
  }
}
