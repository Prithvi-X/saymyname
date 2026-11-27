import {
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({
    example: 'student@study.iitm.ac.in',
    description: 'Approved IIT Madras non-campus BS student institutional email',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'StrongPassphrase123!', minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @ApiPropertyOptional({
    example: 'Aarav',
    description: 'Optional preferred display name (never an institutional roll number)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  displayName?: string;
}

export class LoginDto {
  @ApiProperty({ example: 'student@study.iitm.ac.in' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'StrongPassphrase123!' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password: string;
}

export class VerifyOtpDto {
  @ApiProperty({ example: 'student@study.iitm.ac.in' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: '482910', description: '6-digit email verification code' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'OTP must be a 6-digit numeric code.' })
  otp: string;
}

export class ResendOtpDto {
  @ApiProperty({ example: 'student@study.iitm.ac.in' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'student@study.iitm.ac.in' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'Single-use password reset token' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  token: string;

  @ApiProperty({ example: 'NewStrongPassphrase123!', minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword: string;
}

export class AgeCheckDto {
  @ApiProperty({
    example: '2004-05-15',
    description: 'Date of birth in YYYY-MM-DD format (strict 18+ screen)',
  })
  @IsString()
  @IsNotEmpty()
  dateOfBirth: string;
}

export class VerifyStudentDto {
  @ApiProperty({
    example: 'data_science_applications',
    description: 'One of the 4 approved IITM BS programme families',
    enum: [
      'data_science_applications',
      'electronic_systems',
      'aeronautics_space',
      'management_data_science',
    ],
  })
  @IsString()
  @IsNotEmpty()
  programmeFamily: string;

  @ApiProperty({
    example: 'diploma',
    enum: ['foundation', 'diploma', 'degree'],
    description: 'Current academic level inside the BS programme',
  })
  @IsString()
  @IsIn(['foundation', 'diploma', 'degree'])
  pathwayCode: 'foundation' | 'diploma' | 'degree';

  @ApiPropertyOptional({
    example: '21f1000123',
    description: 'Optional institutional student reference (never shown publicly)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  studentRollNo?: string;

  @ApiPropertyOptional({ description: 'Private R2 non-gov-ID enrolment proof object key' })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  evidenceObjectKey?: string;

  @ApiPropertyOptional({
    enum: ['student_enrolment_letter', 'iitm_portal_screenshot', 'term_fee_receipt'],
  })
  @IsOptional()
  @IsString()
  evidenceType?: string;

  @ApiPropertyOptional({ example: 'application/pdf' })
  @IsOptional()
  @IsString()
  evidenceMimeType?: string;

  @ApiPropertyOptional({ example: 102400 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5 * 1024 * 1024)
  evidenceSizeBytes?: number;

  @ApiPropertyOptional({ description: 'SHA-256 checksum of evidence object' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  evidenceSha256?: string;
}

export class RefreshTokenDto {
  @ApiProperty({ description: 'Opaque refresh token' })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class RevokeOtherSessionsDto {
  @ApiPropertyOptional({ description: 'Optional current refresh token to keep active' })
  @IsOptional()
  @IsString()
  currentRefreshToken?: string;
}

export class DeleteAccountDto {
  @ApiProperty({
    example: 'DELETE MY ACCOUNT',
    description: 'Explicit step-up confirmation phrase ("DELETE MY ACCOUNT")',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  confirmPhrase: string;

  @ApiPropertyOptional({ description: 'Account password step-up verification when password auth is configured' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  password?: string;

  @ApiPropertyOptional({ description: 'Optional member feedback/reason (never logged publicly)' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}
