import { Module } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { MarketsModule } from '../markets/markets.module';
import { NfceModule } from '../nfce/nfce.module';
import { ProductsModule } from '../products/products.module';
import { ReceiptsModule } from '../receipts/receipts.module';
import { AdminController } from './admin.controller';

@Module({
  imports: [ReceiptsModule, ProductsModule, MarketsModule, NfceModule],
  providers: [JwtAuthGuard, RolesGuard],
  controllers: [AdminController],
})
export class AdminModule {}
