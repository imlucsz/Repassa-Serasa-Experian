import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

const DB_CHECK_TIMEOUT_MS = 3000;

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async assertDatabaseReady(): Promise<void> {
    const check = this.prisma.$queryRaw`SELECT 1`;
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('database check timed out')), DB_CHECK_TIMEOUT_MS),
    );
    try {
      await Promise.race([check, timeout]);
    } catch {
      throw new ServiceUnavailableException('Service unavailable');
    }
  }
}
