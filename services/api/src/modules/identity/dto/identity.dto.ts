import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({
    example: 'student@study.iitm.ac.in',
    description: 'IIT Madras student institutional email',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'Arun Kumar', description: 'User display name' })
  @IsString()
  @IsNotEmpty()
  displayName: string;

  @ApiProperty({ example: 'SecurePassword123!', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;
}

export class RequestLoginOtpDto {
  @ApiProperty({
    example: 'student@study.iitm.ac.in',
    description: 'IIT Madras student institutional email',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class VerifyOtpDto {
  @ApiProperty({ example: 'student@study.iitm.ac.in' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: '123456', description: '6-digit OTP' })
  @IsString()
  @IsNotEmpty()
  otp: string;
}

export class AgeCheckDto {
  @ApiProperty({
    example: '2004-05-15',
    description: 'Date of birth in YYYY-MM-DD format (must be 18+)',
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

  @ApiProperty({ example: '21f1000123', description: 'Student Roll / Registration Number' })
  @IsString()
  @IsNotEmpty()
  studentRollNo: string;

  @ApiProperty({
    example: 'evidence/student-id-sample.pdf',
    description: 'Evidence reference key',
    required: false,
  })
  @IsOptional()
  @IsString()
  idDocumentRef?: string;
}

export class RefreshTokenDto {
  @ApiProperty({ description: 'Opaque refresh token' })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
