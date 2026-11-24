import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { DatingService } from './dating.service';
import { LikeCandidateDto, PassCandidateDto, UnmatchDto } from './dto/dating.dto';
import { JwtAuthGuard, AuthenticatedRequest } from '../identity/guards/jwt-auth.guard';
import { EligibilityGuard } from '../identity/guards/eligibility.guard';

@ApiTags('Dating Discovery, Likes & Matches')
@Controller('dating')
@UseGuards(JwtAuthGuard, EligibilityGuard)
@ApiBearerAuth()
export class DatingController {
  constructor(private readonly datingService: DatingService) {}

  @Get('candidates')
  @ApiOperation({ summary: 'Get discovery candidates feed (requires verified adult student)' })
  @ApiResponse({ status: 200, description: 'Filtered candidate profiles' })
  @ApiResponse({ status: 403, description: 'Forbidden if unverified or under 18' })
  getCandidates(@Req() req: AuthenticatedRequest) {
    return this.datingService.getCandidates(req.user.sub);
  }

  @Post('like')
  @ApiOperation({ summary: 'Send Like to candidate (triggers mutual match if reciprocal)' })
  @ApiResponse({ status: 200, description: 'Like response with mutual match boolean' })
  sendLike(@Req() req: AuthenticatedRequest, @Body() dto: LikeCandidateDto) {
    return this.datingService.sendLike(req.user.sub, dto);
  }

  @Post('likes')
  @ApiOperation({ summary: 'Send Like to candidate (alias for plural /likes)' })
  sendLikesAlias(@Req() req: AuthenticatedRequest, @Body() dto: LikeCandidateDto) {
    return this.datingService.sendLike(req.user.sub, dto);
  }

  @Post('pass')
  @ApiOperation({ summary: 'Pass candidate with 30-day cooldown' })
  sendPass(@Req() req: AuthenticatedRequest, @Body() dto: PassCandidateDto) {
    return this.datingService.sendPass(req.user.sub, dto);
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
