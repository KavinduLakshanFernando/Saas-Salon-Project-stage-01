import { Controller, Get, Param } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { RentalsService } from './rentals.service';

@Controller('public/rentals/catalogs')
export class PublicRentalCatalogController {
  constructor(private readonly rentalsService: RentalsService) {}

  @Get(':shareToken')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  getPublicCatalog(@Param('shareToken') shareToken: string) {
    return this.rentalsService.getPublicCatalog(shareToken);
  }
}

