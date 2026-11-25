import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { isHeicDecodingSupported } from '../profiles/image-security';

@ApiTags('Health & System')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Liveness and readiness health probe' })
  @ApiResponse({ status: 200, description: 'Service is operational' })
  check() {
    return {
      status: 'ok',
      service: 'saymyname-api',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
      uptime: process.uptime(),
      capabilities: {
        heicDecoding: isHeicDecodingSupported(),
      },
    };
  }
}
