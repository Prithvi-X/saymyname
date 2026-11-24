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
  RequestLoginOtpDto,
  VerifyOtpDto,
  AgeCheckDto,
  VerifyStudentDto,
  RefreshTokenDto,
} from './dto/identity.dto';
import { JwtAuthGuard, AuthenticatedRequest } from './guards/jwt-auth.guard';

@ApiTags('Identity, Eligibility & Auth')
@Controller('identity')
export class IdentityController {
  constructor(private readonly identityService: IdentityService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Member Login: Request OTP code for institutional @*.study.iitm.ac.in email',
  })
  @ApiResponse({ status: 200, description: 'Login code dispatched to institutional email' })
  @ApiResponse({ status: 400, description: 'Invalid institutional email domain' })
  requestLoginOtp(@Body() dto: RequestLoginOtpDto) {
    return this.identityService.requestLoginOtp(dto.email);
  }

  @Post('register')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Step 1: Register with institutional @*.study.iitm.ac.in email',
  })
  @ApiResponse({ status: 200, description: 'OTP sent to IITM institutional email' })
  @ApiResponse({ status: 400, description: 'Invalid institutional email domain' })
  register(@Body() dto: RegisterDto) {
    return this.identityService.register(dto);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Step 2: Verify 6-digit email OTP and obtain initial session',
  })
  @ApiResponse({ status: 200, description: 'OTP verified, session returned' })
  @ApiResponse({ status: 401, description: 'Invalid or expired OTP' })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.identityService.verifyOtp(dto);
  }

  @Post('age-check')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Step 3: Age Verification Gate (Strict 18+ Boundary)',
  })
  @ApiResponse({ status: 200, description: 'Age verified (18+)' })
  @ApiResponse({ status: 403, description: 'Under-18 rejected' })
  checkAge(@Req() req: AuthenticatedRequest, @Body() dto: AgeCheckDto) {
    return this.identityService.checkAge(req.user.sub, dto);
  }

  @Post('verify-student')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Step 4: Verify enrollment in 1 of 4 approved IITM BS programme tracks',
  })
  @ApiResponse({ status: 200, description: 'Programme verified, dating capabilities unlocked' })
  @ApiResponse({ status: 400, description: 'Invalid programme family' })
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

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated account and eligibility state' })
  @ApiResponse({ status: 200, description: 'Account, eligibility, and profile data' })
  getMe(@Req() req: AuthenticatedRequest) {
    return this.identityService.getMe(req.user.sub);
  }
}
