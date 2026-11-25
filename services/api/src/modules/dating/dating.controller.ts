import { Controller, Get, Post, Delete, Body, Query, Param, Headers, UseGuards, Req, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { DatingService } from './dating.service';
import {
  DiscoveryFeedQueryDto,
  LikesFeedQueryDto,
  SentLikesFeedQueryDto,
  LikeCandidateDto,
  PassCandidateDto,
  UnmatchDto,
  UnmatchReasonDto,
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

  @Get('likes/received')
  @ApiOperation({ summary: 'List paginated active incoming likes for authenticated verified member' })
  @ApiResponse({ status: 200, description: 'Paginated active received likes inbox' })
  getReceivedLikes(@Req() req: AuthenticatedRequest, @Query() query: LikesFeedQueryDto) {
    return this.datingService.getReceivedLikes(req.user.sub, query);
  }

  @Get('likes/received/:likeId')
  @ApiOperation({ summary: 'Inspect sanitized full profile detail for a live incoming like' })
  getReceivedLikeDetail(
    @Req() req: AuthenticatedRequest,
    @Param('likeId', new ParseUUIDPipe()) likeId: string,
  ) {
    return this.datingService.getReceivedLikeDetail(req.user.sub, likeId);
  }

  @Post('likes/received/:likeId/like-back')
  @ApiOperation({ summary: 'Like back an incoming like to create an atomic mutual match' })
  likeBackReceivedLike(
    @Req() req: AuthenticatedRequest,
    @Param('likeId', new ParseUUIDPipe()) likeId: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.datingService.likeBackReceivedLike(req.user.sub, likeId, idempotencyKey);
  }

  @Post('likes/received/:likeId/pass')
  @ApiOperation({ summary: 'Pass on an incoming like privately without notifying sender' })
  passReceivedLike(
    @Req() req: AuthenticatedRequest,
    @Param('likeId', new ParseUUIDPipe()) likeId: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.datingService.passReceivedLike(req.user.sub, likeId, idempotencyKey);
  }

  @Get('likes/sent')
  @ApiOperation({ summary: 'List paginated outgoing likes owned by caller with safe status' })
  getSentLikes(@Req() req: AuthenticatedRequest, @Query() query: SentLikesFeedQueryDto) {
    return this.datingService.getSentLikes(req.user.sub, query);
  }

  @Post('likes/:likeId/withdraw')
  @ApiOperation({ summary: 'Withdraw an active pending outgoing like before a match forms' })
  withdrawLike(
    @Req() req: AuthenticatedRequest,
    @Param('likeId', new ParseUUIDPipe()) likeId: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.datingService.withdrawLike(req.user.sub, likeId, idempotencyKey);
  }

  @Delete('likes/:likeId')
  @ApiOperation({ summary: 'Withdraw an active pending outgoing like (DELETE alias)' })
  withdrawLikeDeleteAlias(
    @Req() req: AuthenticatedRequest,
    @Param('likeId', new ParseUUIDPipe()) likeId: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.datingService.withdrawLike(req.user.sub, likeId, idempotencyKey);
  }

  @Get('matches')
  @ApiOperation({ summary: 'List active mutual matches with sanitized partner profiles' })
  getMatches(@Req() req: AuthenticatedRequest) {
    return this.datingService.getMatches(req.user.sub);
  }

  @Get('matches/:matchId')
  @ApiOperation({ summary: 'Get sanitized summary and profile details for a single active match' })
  getMatchDetail(
    @Req() req: AuthenticatedRequest,
    @Param('matchId', new ParseUUIDPipe()) matchId: string,
  ) {
    return this.datingService.getMatchDetail(req.user.sub, matchId);
  }

  @Post('unmatch')
  @ApiOperation({ summary: 'Unmatch partner and close shared conversation' })
  unmatch(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UnmatchDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.datingService.unmatch(req.user.sub, dto, idempotencyKey);
  }

  @Post('matches/:matchId/unmatch')
  @ApiOperation({ summary: 'Canonical unmatch endpoint scoped by matchId (Doc 06)' })
  unmatchByMatchId(
    @Req() req: AuthenticatedRequest,
    @Param('matchId', new ParseUUIDPipe()) matchId: string,
    @Body() dto?: UnmatchReasonDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.datingService.unmatch(
      req.user.sub,
      { matchId, reason: dto?.reason },
      idempotencyKey,
    );
  }
}
