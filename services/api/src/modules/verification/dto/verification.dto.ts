import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubmitAgeVerificationDto {
  @ApiProperty({
    example: '2004-05-15',
    description: 'Date of birth in YYYY-MM-DD format (strict 18+ eligibility screen)',
  })
  @IsString()
  @IsNotEmpty()
  dateOfBirth: string;
}

export class SubmitStudentVerificationDto {
  @ApiProperty({
    example: 'data_science_applications',
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
    description: 'Academic pathway level in the IITM BS programme',
  })
  @IsString()
  @IsIn(['foundation', 'diploma', 'degree'])
  pathwayCode: 'foundation' | 'diploma' | 'degree';

  @ApiPropertyOptional({
    example: '21f1000123',
    description: 'Optional institutional student roll reference (never displayed publicly)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  studentRollNo?: string;

  @ApiPropertyOptional({
    description: 'Private R2 object key from presigned non-gov-ID enrolment proof upload',
  })
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

  @ApiPropertyOptional({ example: 245760 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5 * 1024 * 1024)
  evidenceSizeBytes?: number;

  @ApiPropertyOptional({ description: 'SHA-256 hex digest of uploaded evidence' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  evidenceSha256?: string;
}

export class PresignEvidenceUploadDto {
  @ApiProperty({
    enum: ['student_enrolment_letter', 'iitm_portal_screenshot', 'term_fee_receipt'],
    description: 'Allowed non-government-ID institutional enrolment proof type',
  })
  @IsString()
  @IsNotEmpty()
  evidenceType: string;

  @ApiProperty({
    enum: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
  })
  @IsString()
  @IsIn(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
  mimeType: string;

  @ApiProperty({ example: 102400 })
  @IsInt()
  @Min(1)
  @Max(5 * 1024 * 1024)
  fileSizeBytes: number;
}

export class ReviewerDecisionDto {
  @ApiProperty({ enum: ['approved', 'needs_information', 'rejected'] })
  @IsString()
  @IsIn(['approved', 'needs_information', 'rejected'])
  decision: 'approved' | 'needs_information' | 'rejected';

  @ApiPropertyOptional({ example: 'enrolment_confirmed' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  reasonCode?: string;

  @ApiPropertyOptional({ example: 'Please attach your current term IITM BS portal screenshot.' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  rejectionReason?: string;

  @ApiPropertyOptional({ example: '2027-05-31T00:00:00Z' })
  @IsOptional()
  @IsString()
  validUntil?: string;
}

export class ReviewerQueueQueryDto {
  @ApiPropertyOptional({ enum: ['pending', 'needs_information', 'all_open'], default: 'all_open' })
  @IsOptional()
  @IsString()
  @IsIn(['pending', 'needs_information', 'all_open'])
  status?: 'pending' | 'needs_information' | 'all_open';

  @ApiPropertyOptional({ enum: ['age', 'student_enrolment'] })
  @IsOptional()
  @IsString()
  @IsIn(['age', 'student_enrolment'])
  checkType?: 'age' | 'student_enrolment';
}
