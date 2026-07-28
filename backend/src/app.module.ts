import { Module } from '@nestjs/common';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { LoggingModule } from './logging/logging.module';
import { HealthController } from './health.controller';
import { MarketsModule } from './markets/markets.module';
import { PricingModule } from './pricing/pricing.module';
import { ProductsModule } from './products/products.module';
import { ReceiptsModule } from './receipts/receipts.module';
import { UserModule } from './user/user.module';

@Module({
  imports: [
    LoggingModule,
    DatabaseModule,
    AuthModule,
    ProductsModule,
    MarketsModule,
    PricingModule,
    ReceiptsModule,
    AdminModule,
    UserModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
