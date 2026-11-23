import { Module, forwardRef } from '@nestjs/common';
import { SubscriptionsModule } from '../../subscriptions/subscriptions.module';
import { TenantModule } from '../../tenant/tenant.module';
import { RentalsController } from './rentals.controller';
import { RentalsService } from './rentals.service';
import { PublicRentalCatalogController } from './public-rental-catalog.controller';

@Module({
  imports: [TenantModule, forwardRef(() => SubscriptionsModule)],
  controllers: [RentalsController, PublicRentalCatalogController],
  providers: [RentalsService],
  exports: [RentalsService],
})
export class RentalsModule {}
