import { Module, forwardRef } from '@nestjs/common';
import { SubscriptionsModule } from '../../subscriptions/subscriptions.module';
import { TenantModule } from '../../tenant/tenant.module';
import { StorageModule } from '../../common/storage/storage.module';
import { WebsitesController } from './websites.controller';
import { PublicWebsitesController } from './public-websites.controller';
import { WebsitesService } from './websites.service';

@Module({
  imports: [TenantModule, forwardRef(() => SubscriptionsModule), StorageModule],
  controllers: [WebsitesController, PublicWebsitesController],
  providers: [WebsitesService],
  exports: [WebsitesService],
})
export class WebsitesModule {}
