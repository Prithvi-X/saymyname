import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { IdentityService } from './identity.service';
import {
  RegisterDto,
  LoginDto,
  VerifyOtpDto,
  ResendOtpDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  AgeCheckDto,
  VerifyStudentDto,
  RefreshTokenDto,
  RevokeOtherSessionsDto,
  DeleteAccountDto,
} from './dto/identity.dto';
import { Delete } from '@nestjs/common';
import { JwtAuthGuard, AuthenticatedRequest } from './guards/jwt-auth.guard';

@ApiTags('Identity, Eligibility & Auth')
@Controller('identity')
export class IdentityController {
  constructor(private readonly identityService: IdentityService) {}

  @Post('register')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Step 1: Register with approved IITM non-campus BS email & password',
  })
  @ApiResponse({ status: 200, description: 'Email verification OTP dispatched' })
  @ApiResponse({ status: 400, description: 'Invalid institutional email domain or payload' })
  register(@Body() dto: RegisterDto) {
    return this.identityService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Member Login: Authenticate using verified institutional email & password',
  })
  @ApiResponse({ status: 200, description: 'Authenticated session returned' })
  @ApiResponse({ status: 401, description: 'Invalid email or password' })
  login(@Body() dto: LoginDto) {
    return this.identityService.login(dto);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Step 2: Verify 6-digit email OTP against persistent challenge and obtain session',
  })
  @ApiResponse({ status: 200, description: 'Email verified, session returned' })
  @ApiResponse({ status: 401, description: 'Invalid or expired verification code' })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.identityService.verifyOtp(dto);
  }

  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend email verification OTP respecting cooldown' })
  resendOtp(@Body() dto: ResendOtpDto) {
    return this.identityService.resendOtp(dto.email);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset link for institutional email' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.identityService.forgotPassword(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete password reset using single-use token' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.identityService.resetPassword(dto);
  }

  @Post('age-check')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Step 3: Submit 18+ age eligibility screen (pending verification review)',
  })
  @ApiResponse({ status: 200, description: 'Age case created and queued for review' })
  @ApiResponse({ status: 403, description: 'Under-18 rejected' })
  checkAge(@Req() req: AuthenticatedRequest, @Body() dto: AgeCheckDto) {
    return this.identityService.checkAge(req.user.sub, dto);
  }

  @Post('verify-student')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Step 4: Submit IITM non-campus BS student enrolment verification case',
  })
  @ApiResponse({ status: 200, description: 'Student verification case queued for review' })
  @ApiResponse({ status: 400, description: 'Invalid programme track or pathway' })
  verifyStudent(@Req() req: AuthenticatedRequest, @Body() dto: VerifyStudentDto) {
    return this.identityService.verifyStudent(req.user.sub, dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate session tokens using refresh token' })
  @ApiResponse({ status: 200, description: 'New access and refresh tokens returned' })
  refreshToken(@Body() dto: RefreshTokenDto) {
    return this.identityService.refreshToken(dto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke active refresh token session' })
  logout(@Body() dto: RefreshTokenDto) {
    return this.identityService.logout(dto.refreshToken);
  }

  @Post('sessions/revoke-others')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke all other active sessions for this account' })
  revokeOthers(@Req() req: AuthenticatedRequest, @Body() dto: RevokeOtherSessionsDto) {
    return this.identityService.revokeOtherSessions(req.user.sub, dto.currentRefreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated account, lifecycle state, and eligibility' })
  @ApiResponse({ status: 200, description: 'Account, lifecycleState, eligibility, and profile data' })
  getMe(@Req() req: AuthenticatedRequest) {
    return this.identityService.getMe(req.user.sub);
  }

  @Delete('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Step-up self-service account deletion (30-day DPDP grace window before hard purge)' })
  @ApiResponse({ status: 200, description: 'Account deactivated, sessions/matches/calls revoked, purge scheduled' })
  deleteMe(@Req() req: AuthenticatedRequest, @Body() dto: DeleteAccountDto) {
    return this.identityService.deleteAccount(req.user.sub, dto);
  }
}
