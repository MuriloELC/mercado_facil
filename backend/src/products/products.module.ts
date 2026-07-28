import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductClassifierService } from './product-classifier.service';

@Module({
  providers: [ProductsService, ProductClassifierService],
  exports: [ProductsService, ProductClassifierService],
})
export class ProductsModule {}
