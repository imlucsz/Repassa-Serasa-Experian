import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InstitutionsController } from './institutions.controller';
import { InstitutionsService } from './institutions.service';
import { MyInstitutionsController } from './my-institutions.controller';

@Module({
  imports: [AuthModule],
  controllers: [InstitutionsController, MyInstitutionsController],
  providers: [InstitutionsService],
})
export class InstitutionsModule {}
