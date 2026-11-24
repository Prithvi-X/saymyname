import { IsString, IsOptional, IsArray, IsInt, Min, Max, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiProperty({ example: 'Priya Sharma' })
  @IsString()
  displayName: string;

  @ApiPropertyOptional({ example: 'BS Data Science student passionate about ML and classical music.' })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({ example: 'Year 2, Term 4' })
  @IsOptional()
  @IsString()
  termOrYear?: string;

  @ApiPropertyOptional({ example: 'Chennai' })
  @IsOptional()
  @IsString()
  locationCity?: string;

  @ApiPropertyOptional({ example: 'Tamil Nadu' })
  @IsOptional()
  @IsString()
  locationState?: string;

  @ApiPropertyOptional({ example: 'Long-term connection' })
  @IsOptional()
  @IsString()
  intention?: string;

  @ApiPropertyOptional({ example: ['Machine Learning', 'Music', 'Hiking', 'Chess'] })
  @IsOptional()
  @IsArray()
  interests?: string[];
}

export class AddPhotoDto {
  @ApiProperty({ example: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb' })
  @IsString()
  photoUrl: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  displayOrder?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
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

  @ApiProperty({ example: 'image/jpeg', description: 'MIME type (image/jpeg, image/png, image/webp)' })
  @IsString()
  mimeType!: string;

  @ApiPropertyOptional({ example: 1048576, description: 'File size in bytes (max 10MB)' })
  @IsOptional()
  @IsInt()
  @Max(10485760) // 10 MB
  fileSizeBytes?: number;
}
