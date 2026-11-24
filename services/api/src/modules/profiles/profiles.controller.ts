import { Controller, Get, Put, Post, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { ProfilesService } from './profiles.service';
import { UpdateProfileDto, AddPhotoDto, UpdatePreferencesDto } from './dto/profile.dto';
import { JwtAuthGuard, AuthenticatedRequest } from '../identity/guards/jwt-auth.guard';

@ApiTags('Profiles & Settings')
@Controller('profiles')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user full dating profile' })
  @ApiResponse({ status: 200, description: 'Profile details with photos and preferences' })
  getProfile(@Req() req: AuthenticatedRequest) {
    return this.profilesService.getProfile(req.user.sub);
  }

  @Put('me')
  @ApiOperation({ summary: 'Update profile bio, display name and details' })
  updateProfile(@Req() req: AuthenticatedRequest, @Body() dto: UpdateProfileDto) {
    return this.profilesService.updateProfile(req.user.sub, dto);
  }

  @Post('me/photos')
  @ApiOperation({ summary: 'Add a photo to profile (up to 6 photos max)' })
  addPhoto(@Req() req: AuthenticatedRequest, @Body() dto: AddPhotoDto) {
    return this.profilesService.addPhoto(req.user.sub, dto);
  }

  @Delete('me/photos/:id')
  @ApiOperation({ summary: 'Delete a photo from profile' })
  removePhoto(@Req() req: AuthenticatedRequest, @Param('id') photoId: string) {
    return this.profilesService.removePhoto(req.user.sub, photoId);
  }

  @Put('me/preferences')
  @ApiOperation({ summary: 'Update dating discovery filters and preferences' })
  updatePreferences(@Req() req: AuthenticatedRequest, @Body() dto: UpdatePreferencesDto) {
    return this.profilesService.updatePreferences(req.user.sub, dto);
  }

  @Put('me/publish')
  @ApiOperation({ summary: 'Toggle profile discoverability (published/hidden)' })
  togglePublish(@Req() req: AuthenticatedRequest, @Body('isPublished') isPublished: boolean) {
    return this.profilesService.togglePublish(req.user.sub, isPublished);
  }
}
