import { Global, Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SmsService } from './sms.service';
import { SmsWalletService } from './sms-wallet.service';
import { SmsPackagesService } from './sms-packages.service';
import { SmsController } from './sms.controller';
import { PaymentsModule } from '../payments/payments.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TenantModule } from '../tenant/tenant.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

import { SmsRechargeRequestsService } from './sms-recharge-requests.service';

@Global()
@Module({
  imports: [
    ConfigModule,
    forwardRef(() => PaymentsModule),
    NotificationsModule,
    forwardRef(() => TenantModule),
    forwardRef(() => SubscriptionsModule),
  ],
  controllers: [SmsController],
  providers: [SmsService, SmsWalletService, SmsPackagesService, SmsRechargeRequestsService],
  exports: [SmsService, SmsWalletService, SmsPackagesService, SmsRechargeRequestsService],
})
export class SmsModule {}
