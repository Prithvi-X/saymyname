import {
  IsString,
  IsOptional,
  IsArray,
  IsInt,
  Min,
  Max,
  IsBoolean,
  IsIn,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PromptAnswerInputDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  promptId?: string;

  @ApiPropertyOptional({ example: 'What course from the BS degree surprised you most?' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  promptText?: string;

  @ApiProperty({ example: 'Machine Learning Foundations completely changed how I think about data.' })
  @IsString()
  @MaxLength(250)
  answerText!: string;
}

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Priya Sharma' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  displayName?: string;

  @ApiPropertyOptional({
    example: 'BS Data Science student passionate about ML and acoustic music.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @ApiPropertyOptional({ example: 'Diploma in Data Science' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  termOrYear?: string;

  @ApiPropertyOptional({ example: 'Chennai' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  locationCity?: string;

  @ApiPropertyOptional({ example: 'Tamil Nadu' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  locationState?: string;

  @ApiPropertyOptional({ example: 'Long-term connection' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  intention?: string;

  @ApiPropertyOptional({ enum: ['hidden', 'show_calculated_age'] })
  @IsOptional()
  @IsString()
  @IsIn(['hidden', 'show_calculated_age'])
  ageDisplayMode?: 'hidden' | 'show_calculated_age';

  @ApiPropertyOptional({ example: ['Machine Learning', 'Music', 'Hiking', 'Chess'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interests?: string[];

  @ApiPropertyOptional({ type: [PromptAnswerInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PromptAnswerInputDto)
  promptAnswers?: PromptAnswerInputDto[];
}

export class AddPhotoDto {
  @ApiProperty({
    example: 'photos/account-uuid/photo-uuid.jpg',
    description: 'Authorised private Cloudflare R2 object key from presign endpoint',
  })
  @IsString()
  s3Key!: string;

  @ApiPropertyOptional({ example: 'image/jpeg' })
  @IsOptional()
  @IsString()
  @IsIn(['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
  mimeType?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  displayOrder?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional({ example: 1080 })
  @IsOptional()
  @IsInt()
  widthPx?: number;

  @ApiPropertyOptional({ example: 1350 })
  @IsOptional()
  @IsInt()
  heightPx?: number;
}

export class UpdatePreferencesDto {
  @ApiPropertyOptional({ example: 18, minimum: 18 })
  @IsOptional()
  @IsInt()
  @Min(18)
  minAge?: number;

  @ApiPropertyOptional({ example: 30, maximum: 50 })
  @IsOptional()
  @IsInt()
  @Max(50)
  maxAge?: number;

  @ApiPropertyOptional({ example: ['data_science_applications', 'electronic_systems'] })
  @IsOptional()
  @IsArray()
  allowedProgrammes?: string[];

  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @IsInt()
  maxDistanceKm?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  showInDiscovery?: boolean;
}

export class PresignPhotoDto {
  @ApiProperty({ example: 'profile.jpg', description: 'Original filename' })
  @IsString()
  filename!: string;

  @ApiProperty({
    example: 'image/jpeg',
    description: 'MIME type (image/jpeg, image/png, image/webp, image/heic)',
  })
  @IsString()
  mimeType!: string;

  @ApiPropertyOptional({ example: 1048576, description: 'File size in bytes (max 10MB)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10485760)
  fileSizeBytes?: number;
}

export class PublishProfileDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Explicit member agreement to Safety & Community Commitments',
  })
  @IsOptional()
  @IsBoolean()
  acceptGuidelinesConsent?: boolean;
}
