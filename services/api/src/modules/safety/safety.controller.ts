import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { SafetyService } from './safety.service';
import { BlockUserDto, ReportUserDto } from './dto/safety.dto';
import { JwtAuthGuard, AuthenticatedRequest } from '../identity/guards/jwt-auth.guard';

@ApiTags('Trust, Safety, Blocking & Reporting')
@Controller('safety')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SafetyController {
  constructor(private readonly safetyService: SafetyService) {}

  @Post('block')
  @ApiOperation({ summary: 'Instant bi-directional user block (unmatches and hides profiles)' })
  @ApiResponse({ status: 200, description: 'User blocked' })
  blockUser(@Req() req: AuthenticatedRequest, @Body() dto: BlockUserDto) {
    return this.safetyService.blockUser(req.user.sub, dto);
  }

  @Post('report')
  @ApiOperation({ summary: 'Report a profile or chat violation to Trust & Safety team' })
  @ApiResponse({ status: 200, description: 'Report registered for moderation investigation' })
  reportUser(@Req() req: AuthenticatedRequest, @Body() dto: ReportUserDto) {
    return this.safetyService.reportUser(req.user.sub, dto);
  }
}
