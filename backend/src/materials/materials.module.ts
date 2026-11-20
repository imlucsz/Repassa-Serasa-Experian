import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DonationsController } from './donations.controller';
import { InstitutionMaterialsController } from './institution-materials.controller';
import { MaterialsController } from './materials.controller';
import { MaterialsService } from './materials.service';

@Module({
  imports: [AuthModule],
  controllers: [MaterialsController, DonationsController, InstitutionMaterialsController],
  providers: [MaterialsService],
})
export class MaterialsModule {}
