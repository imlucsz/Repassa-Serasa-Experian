import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminService } from './admin.service';
import { AdminInstitutionsController } from './admin-institutions.controller';
import { AdminUsersController } from './admin-users.controller';
import { AdminViewsController } from './admin-views.controller';

@Module({
  imports: [AuthModule],
  controllers: [AdminInstitutionsController, AdminUsersController, AdminViewsController],
  providers: [AdminService],
})
export class AdminModule {}
