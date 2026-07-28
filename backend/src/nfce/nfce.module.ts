import { Module } from '@nestjs/common';
import { ReceiptsModule } from '../receipts/receipts.module';
import { NfceExtractionService } from './nfce-extraction.service';
import { NfcePlaywrightService } from './nfce-playwright.service';
import { NfceService } from './nfce.service';

@Module({
  imports: [ReceiptsModule],
  providers: [NfceService, NfceExtractionService, NfcePlaywrightService],
  exports: [NfceService],
})
export class NfceModule {}
