import { Module } from '@nestjs/common';
import { MarketsModule } from '../markets/markets.module';
import { PricingModule } from '../pricing/pricing.module';
import { ProductsModule } from '../products/products.module';
import { ReceiptsService } from './receipts.service';

@Module({
  imports: [MarketsModule, ProductsModule, PricingModule],
  providers: [ReceiptsService],
  exports: [ReceiptsService],
})
export class ReceiptsModule {}
