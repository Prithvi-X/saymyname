import { Controller, Get, Post, Body, Query, Param, Headers, UseGuards, Req, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { DatingService } from './dating.service';
import {
  DiscoveryFeedQueryDto,
  LikeCandidateDto,
  PassCandidateDto,
  UnmatchDto,
} from './dto/dating.dto';
import { JwtAuthGuard, AuthenticatedRequest } from '../identity/guards/jwt-auth.guard';
import { EligibilityGuard } from '../identity/guards/eligibility.guard';

@ApiTags('Dating Discovery, Likes & Matches')
@Controller('dating')
@UseGuards(JwtAuthGuard, EligibilityGuard)
@ApiBearerAuth()
export class DatingController {
  constructor(private readonly datingService: DatingService) {}

  @Get('candidates')
  @ApiOperation({ summary: 'Get paginated discovery candidates feed (requires verified 18+ IITM BS student)' })
  @ApiResponse({ status: 200, description: 'Reciprocally filtered discovery candidates page' })
  @ApiResponse({ status: 403, description: 'Forbidden if unverified or under 18' })
  getCandidates(@Req() req: AuthenticatedRequest, @Query() query: DiscoveryFeedQueryDto) {
    return this.datingService.getCandidates(req.user.sub, query);
  }

  @Get('candidates/:profileId')
  @ApiOperation({ summary: 'Get sanitized full discovery profile detail for a single eligible candidate' })
  @ApiResponse({ status: 200, description: 'Sanitized candidate profile detail' })
  @ApiResponse({ status: 404, description: 'Candidate unavailable, paused, or blocked' })
  getCandidateDetail(
    @Req() req: AuthenticatedRequest,
    @Param('profileId', new ParseUUIDPipe()) profileId: string,
  ) {
    return this.datingService.getCandidateDetail(req.user.sub, profileId);
  }

  @Post('like')
  @ApiOperation({ summary: 'Send Like to candidate (triggers mutual match if reciprocal)' })
  @ApiResponse({ status: 200, description: 'Like response with mutual match boolean' })
  sendLike(
    @Req() req: AuthenticatedRequest,
    @Body() dto: LikeCandidateDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.datingService.sendLike(req.user.sub, dto, idempotencyKey);
  }

  @Post('likes')
  @ApiOperation({ summary: 'Send Like to candidate (canonical plural /likes endpoint)' })
  sendLikesAlias(
    @Req() req: AuthenticatedRequest,
    @Body() dto: LikeCandidateDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.datingService.sendLike(req.user.sub, dto, idempotencyKey);
  }

  @Post('pass')
  @ApiOperation({ summary: 'Pass candidate privately with cooldown suppression' })
  sendPass(
    @Req() req: AuthenticatedRequest,
    @Body() dto: PassCandidateDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.datingService.sendPass(req.user.sub, dto, idempotencyKey);
  }

  @Post('passes')
  @ApiOperation({ summary: 'Pass candidate privately (canonical plural /passes endpoint)' })
  sendPassesAlias(
    @Req() req: AuthenticatedRequest,
    @Body() dto: PassCandidateDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.datingService.sendPass(req.user.sub, dto, idempotencyKey);
  }

  @Get('matches')
  @ApiOperation({ summary: 'List active mutual matches and conversations' })
  getMatches(@Req() req: AuthenticatedRequest) {
    return this.datingService.getMatches(req.user.sub);
  }

  @Post('unmatch')
  @ApiOperation({ summary: 'Unmatch partner and close shared conversation' })
  unmatch(@Req() req: AuthenticatedRequest, @Body() dto: UnmatchDto) {
    return this.datingService.unmatch(req.user.sub, dto);
  }
}
