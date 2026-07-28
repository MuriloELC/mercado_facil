import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { extname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateMarketDto } from '../markets/dto/create-market.dto';
import { MarketsService } from '../markets/markets.service';
import { IntakeNfceDto } from '../nfce/dto/intake-nfce.dto';
import { ListNfceQueueDto } from '../nfce/dto/list-nfce-queue.dto';
import { ScrapeAfterCaptchaDto } from '../nfce/dto/scrape-after-captcha.dto';
import { NfceService } from '../nfce/nfce.service';
import { CreateProductDto } from '../products/dto/create-product.dto';
import { ClassifyProductDto } from '../products/dto/classify-product.dto';
import { ProductsService } from '../products/products.service';
import { ProductClassifierService } from '../products/product-classifier.service';
import { IntakeReceiptDto } from '../receipts/dto/intake-receipt.dto';
import { ListReceiptsDto } from '../receipts/dto/list-receipts.dto';
import { ManualProcessReceiptDto } from '../receipts/dto/manual-process-receipt.dto';
import { ReceiptsService } from '../receipts/receipts.service';
import { ListCatalogDto } from './dto/list-catalog.dto';

const uploadDir = process.env.UPLOAD_DIR ?? 'uploads/receipts';
if (!existsSync(uploadDir)) {
  mkdirSync(uploadDir, { recursive: true });
}

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(
    private readonly receiptsService: ReceiptsService,
    private readonly productsService: ProductsService,
    private readonly productClassifierService: ProductClassifierService,
    private readonly marketsService: MarketsService,
    private readonly nfceService: NfceService,
  ) {}

  @Post('nfce/intake')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: uploadDir,
        filename: (_req, file, callback) => {
          const extension = extname(file.originalname || '.jpg');
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          callback(null, `${unique}${extension}`);
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  intakeNfceForReview(
    @CurrentUser() user: JwtUser,
    @Body() dto: IntakeNfceDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Image file is required.');
    }
    return this.nfceService.intakeFromUser(user.userId, file, dto.ocr_hint_text);
  }

  @Get('nfce/review-queue')
  listNfceReviewQueue(@Query() query: ListNfceQueueDto) {
    return this.nfceService.listQueue(query.status);
  }

  @Get('nfce/review-queue/:id')
  getNfceReviewItem(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.nfceService.getQueueItemById(id);
  }

  @Get('nfce/review-queue/:id/prefill')
  getNfceManualPrefill(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.nfceService.getManualPrefill(id);
  }

  @Post('nfce/review-queue/:id/select')
  selectNfceReviewItem(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.nfceService.markInReview(id, user.userId);
  }

  @Post('nfce/review-queue/:id/start-consultation')
  startNfceAssistedConsultation(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.nfceService.startAssistedConsultation(id, user.userId);
  }
  @Post('nfce/review-queue/:id/playwright/start')
  startNfcePlaywrightSession(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.nfceService.startPlaywrightAssistedSession(id, user.userId);
  }

  @Get('nfce/review-queue/:id/playwright/state')
  getNfcePlaywrightState(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.nfceService.getPlaywrightSessionState(id);
  }

  @Post('nfce/review-queue/:id/playwright/scrape')
  scrapeNfceViaPlaywright(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.nfceService.scrapeFromPlaywrightSession(id, user.userId);
  }

  @Post('nfce/review-queue/:id/playwright/close')
  closeNfcePlaywrightSession(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.nfceService.closePlaywrightSession(id);
  }
  @Post('nfce/review-queue/:id/scrape-after-captcha')
  scrapeNfceAfterCaptcha(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: JwtUser,
    @Body() body: ScrapeAfterCaptchaDto,
  ) {
    return this.nfceService.scrapeAfterManualCaptcha(id, user.userId, body.page_html);
  }

  @Post('nfce/review-queue/:id/reprocess')
  reprocessNfceReference(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: { ocr_hint_text?: string },
  ) {
    return this.nfceService.retryReferenceExtraction(id, body?.ocr_hint_text);
  }

  @Post('receipts/intake')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: uploadDir,
        filename: (_req, file, callback) => {
          const extension = extname(file.originalname || '.jpg');
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          callback(null, `${unique}${extension}`);
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  intakeReceipt(
    @CurrentUser() user: JwtUser,
    @Body() dto: IntakeReceiptDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.receiptsService.intake(user.userId, dto, file);
  }

  @Get('receipts')
  listReceipts(@Query() query: ListReceiptsDto) {
    return this.receiptsService.list(query);
  }

  @Get('receipts/:id')
  getReceipt(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.receiptsService.getById(id);
  }

  @Post('receipts/:id/claim')
  claimReceipt(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.receiptsService.claim(id, user.userId);
  }

  @Put('receipts/:id/manual-process')
  manualProcessReceipt(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: ManualProcessReceiptDto,
  ) {
    return this.receiptsService.manualProcess(id, user.userId, dto);
  }

  @Post('receipts/:id/mark-failed')
  markReceiptFailed(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.receiptsService.markFailed(id, user.userId);
  }

  @Post('receipts/:id/mark-duplicate')
  markReceiptDuplicate(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.receiptsService.markDuplicate(id, user.userId);
  }

  @Get('products')
  listProducts(@Query() query: ListCatalogDto) {
    return this.productsService.findAll(query.q, query.limit);
  }

  @Post('products/classify')
  classifyProduct(@Body() dto: ClassifyProductDto) {
    return this.productClassifierService.classify(dto);
  }

  @Post('products')
  createProduct(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Get('markets')
  listMarkets(@Query() query: ListCatalogDto) {
    return this.marketsService.findAll(query.q, query.limit);
  }

  @Post('markets')
  createMarket(@Body() dto: CreateMarketDto) {
    return this.marketsService.create(dto);
  }
}
