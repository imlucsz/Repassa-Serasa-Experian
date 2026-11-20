import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InstitutionReservationsController } from './institution-reservations.controller';
import { PickupCodeService } from './pickup-code.service';
import { ReservationExpiryService } from './reservation-expiry.service';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';

@Module({
  imports: [AuthModule],
  controllers: [ReservationsController, InstitutionReservationsController],
  providers: [ReservationsService, ReservationExpiryService, PickupCodeService],
  // Expiry reconciliation is shared with the catalog (expired stock reappears).
  exports: [ReservationExpiryService],
})
export class ReservationsModule {}
