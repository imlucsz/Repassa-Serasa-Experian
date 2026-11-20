import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthService } from './health.service';

interface HealthResponse {
  status: 'ok';
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  /**
   * Contract endpoint: readiness including minimal DB connectivity.
   * Returns 503 via the error filter when the database is unreachable.
   */
  @Get()
  @ApiOperation({ summary: 'health', description: 'Database readiness, no sensitive details.' })
  async readiness(): Promise<HealthResponse> {
    await this.health.assertDatabaseReady();
    return { status: 'ok' };
  }

  /** Process liveness only (no DB); additive operational endpoint. */
  @Get('live')
  @ApiOperation({ summary: 'liveness', description: 'Process liveness, no database check.' })
  liveness(): HealthResponse {
    return { status: 'ok' };
  }
}
