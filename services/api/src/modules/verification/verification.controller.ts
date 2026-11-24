import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { JwtAuthGuard, AuthenticatedRequest } from '../identity/guards/jwt-auth.guard';
import { VerificationService } from './verification.service';
import { ReviewerGuard } from './reviewer.guard';
import {
  SubmitAgeVerificationDto,
  SubmitStudentVerificationDto,
  PresignEvidenceUploadDto,
  ReviewerDecisionDto,
  ReviewerQueueQueryDto,
} from './dto/verification.dto';

@ApiTags('Verification & Eligibility Review')
@Controller('verification-cases')
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Post('age')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit 18+ age verification assertion via AgeVerificationAdapter' })
  submitAge(@Req() req: AuthenticatedRequest, @Body() dto: SubmitAgeVerificationDto) {
    return this.verificationService.submitAgeVerification(req.user.sub, dto);
  }

  @Post('evidence/presign')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Presign private R2 upload for non-gov-ID IITM BS enrolment proof',
  })
  presignEvidence(@Req() req: AuthenticatedRequest, @Body() dto: PresignEvidenceUploadDto) {
    return this.verificationService.presignEvidenceUpload(req.user.sub, dto);
  }

  @Post('student')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Submit IITM non-campus BS student enrolment verification case',
  })
  submitStudent(
    @Req() req: AuthenticatedRequest,
    @Body() dto: SubmitStudentVerificationDto,
  ) {
    return this.verificationService.submitStudentEnrolmentVerification(req.user.sub, dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List own verification cases (redacted status view)' })
  getMyCases(@Req() req: AuthenticatedRequest) {
    return this.verificationService.getMyCases(req.user.sub);
  }

  @Get('pending')
  @UseGuards(ReviewerGuard)
  @ApiHeader({ name: 'x-smn-reviewer-key', required: true })
  @ApiHeader({ name: 'x-smn-reviewer-id', required: false })
  @ApiOperation({
    summary: 'List open manual verification queue cases for authorised reviewers (no external provider automation)',
  })
  getPendingQueue(@Req() req: any, @Query() query: ReviewerQueueQueryDto) {
    return this.verificationService.getPendingQueue(req.reviewerPrincipalId, query);
  }

  @Get('evidence/:evidenceId/url')
  @UseGuards(ReviewerGuard)
  @ApiHeader({ name: 'x-smn-reviewer-key', required: true })
  @ApiHeader({ name: 'x-smn-reviewer-id', required: false })
  @ApiOperation({
    summary: 'Issue temporary 120s presigned read URL for uploaded non-gov-ID enrolment proof',
  })
  getEvidenceReadUrl(@Req() req: any, @Param('evidenceId') evidenceId: string) {
    return this.verificationService.getReviewerEvidenceReadUrl(
      evidenceId,
      req.reviewerPrincipalId,
    );
  }

  @Post(':id/decision')
  @UseGuards(ReviewerGuard)
  @ApiHeader({ name: 'x-smn-reviewer-key', required: true })
  @ApiHeader({ name: 'x-smn-reviewer-id', required: false })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Authorised human reviewer decision for a pending manual verification case',
  })
  decideCase(
    @Req() req: any,
    @Param('id') caseId: string,
    @Body() dto: ReviewerDecisionDto,
  ) {
    return this.verificationService.decideCase(req.reviewerPrincipalId, caseId, dto);
  }
}
