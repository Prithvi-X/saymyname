import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { ProfilesService } from './profiles.service';
import {
  UpdateProfileDto,
  AddPhotoDto,
  UpdatePreferencesDto,
  PresignPhotoDto,
  PublishProfileDto,
  ReorderPhotosDto,
} from './dto/profile.dto';
import { JwtAuthGuard, AuthenticatedRequest } from '../identity/guards/jwt-auth.guard';

@ApiTags('Profiles & Settings')
@Controller('profiles')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get('catalog')
  @ApiOperation({ summary: 'Get active interests and profile prompts catalog' })
  getCatalog() {
    return this.profilesService.getCatalog();
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile (initializes draft if absent)' })
  @ApiResponse({ status: 200, description: 'Profile details with signed R2 photo URLs' })
  getProfile(@Req() req: AuthenticatedRequest) {
    return this.profilesService.getProfile(req.user.sub);
  }

  @Put('me')
  @ApiOperation({ summary: 'Update profile fields, interests, and prompt answers (draft allowed)' })
  updateProfile(@Req() req: AuthenticatedRequest, @Body() dto: UpdateProfileDto) {
    return this.profilesService.updateProfile(req.user.sub, dto);
  }

  @Post('me/photos/presign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pre-sign a private Cloudflare R2 photo upload PUT URL' })
  presignPhoto(@Req() req: AuthenticatedRequest, @Body() dto: PresignPhotoDto) {
    return this.profilesService.presignPhoto(req.user.sub, dto);
  }

  @Post('me/photos')
  @ApiOperation({ summary: 'Attach an uploaded private R2 portrait photo (up to 6 photos max)' })
  addPhoto(@Req() req: AuthenticatedRequest, @Body() dto: AddPhotoDto) {
    return this.profilesService.addPhoto(req.user.sub, dto);
  }

  @Get('me/photos/:id/url')
  @ApiOperation({ summary: 'Issue a short-lived signed GET URL for own portrait preview' })
  getPhotoUrl(@Req() req: AuthenticatedRequest, @Param('id') photoId: string) {
    return this.profilesService.getSignedPhotoUrl(req.user.sub, photoId);
  }

  @Put('me/photos/:id/primary')
  @ApiOperation({ summary: 'Set primary portrait photo' })
  setPrimaryPhoto(@Req() req: AuthenticatedRequest, @Param('id') photoId: string) {
    return this.profilesService.setPrimaryPhoto(req.user.sub, photoId);
  }

  @Put('me/photos/reorder')
  @ApiOperation({ summary: 'Reorder portrait photos within profile (index 0 is primary)' })
  reorderPhotos(@Req() req: AuthenticatedRequest, @Body() dto: ReorderPhotosDto) {
    return this.profilesService.reorderPhotos(req.user.sub, dto.photoIds);
  }

  @Delete('me/photos/:id')
  @ApiOperation({ summary: 'Remove a portrait photo from profile' })
  removePhoto(@Req() req: AuthenticatedRequest, @Param('id') photoId: string) {
    return this.profilesService.removePhoto(req.user.sub, photoId);
  }

  @Get('me/preferences')
  @ApiOperation({ summary: 'Retrieve private dating discovery filters and preferences' })
  getPreferences(@Req() req: AuthenticatedRequest) {
    return this.profilesService.getPreferences(req.user.sub);
  }

  @Put('me/preferences')
  @ApiOperation({ summary: 'Update dating discovery filters and preferences' })
  updatePreferences(@Req() req: AuthenticatedRequest, @Body() dto: UpdatePreferencesDto) {
    return this.profilesService.updatePreferences(req.user.sub, dto);
  }

  @Get('me/preview')
  @ApiOperation({ summary: 'Preview own profile exactly as peers view it in Discovery' })
  getPreviewProfile(@Req() req: AuthenticatedRequest) {
    return this.profilesService.getPreviewProfile(req.user.sub);
  }

  @Get(':id/public')
  @ApiOperation({ summary: 'Get public profile for active peer in Discovery' })
  getPublicProfile(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.profilesService.getPublicProfile(req.user.sub, id);
  }

  @Post('me/publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Publish completed profile into Discover (requires verified eligibility & >=1 photo)',
  })
  publishProfile(@Req() req: AuthenticatedRequest, @Body() dto: PublishProfileDto) {
    return this.profilesService.publishProfile(req.user.sub, {
      ...dto,
      isPublished: true,
    });
  }

  @Put('me/publish')
  @ApiOperation({ summary: 'Publish or pause profile discoverability' })
  togglePublish(@Req() req: AuthenticatedRequest, @Body() dto: PublishProfileDto) {
    return this.profilesService.publishProfile(req.user.sub, dto);
  }
}
