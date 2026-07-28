import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateShoppingListItemDto } from './dto/create-shopping-list-item.dto';
import { CreateShoppingListDto } from './dto/create-shopping-list.dto';
import { UpdateShoppingListItemDto } from './dto/update-shopping-list-item.dto';
import { UpdateShoppingListDto } from './dto/update-shopping-list.dto';
import { IntakeNfceDto } from '../nfce/dto/intake-nfce.dto';
import { NfceService } from '../nfce/nfce.service';
import { UserService } from './user.service';

const uploadDir = process.env.UPLOAD_DIR ?? 'uploads/receipts';
if (!existsSync(uploadDir)) {
  mkdirSync(uploadDir, { recursive: true });
}

@Controller('user')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(
    private readonly userService: UserService,
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
  intakeNfce(
    @CurrentUser() user: JwtUser,
    @Body() dto: IntakeNfceDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const qrText = dto.qr_text?.trim();

    if (file) {
      return this.nfceService.intakeFromUser(
        user.userId,
        file,
        dto.ocr_hint_text ?? qrText,
      );
    }

    if (qrText) {
      return this.nfceService.intakeQrTextFromUser(user.userId, qrText);
    }

    throw new BadRequestException('Image file or qr_text is required.');
  }

  @Get('nfce/intakes')
  listOwnNfceIntakes(@CurrentUser() user: JwtUser) {
    return this.nfceService.listQueueForUser(user.userId);
  }

  @Post('lists')
  createList(@CurrentUser() user: JwtUser, @Body() dto: CreateShoppingListDto) {
    return this.userService.createShoppingList(user.userId, dto);
  }

  @Get('lists')
  listLists(@CurrentUser() user: JwtUser) {
    return this.userService.listShoppingLists(user.userId);
  }

  @Patch('lists/:listId')
  updateList(
    @CurrentUser() user: JwtUser,
    @Param('listId', new ParseUUIDPipe()) listId: string,
    @Body() dto: UpdateShoppingListDto,
  ) {
    return this.userService.updateShoppingList(user.userId, listId, dto);
  }

  @Delete('lists/:listId')
  deleteList(
    @CurrentUser() user: JwtUser,
    @Param('listId', new ParseUUIDPipe()) listId: string,
  ) {
    return this.userService.deleteShoppingList(user.userId, listId);
  }

  @Get('lists/:listId/items')
  listItems(
    @CurrentUser() user: JwtUser,
    @Param('listId', new ParseUUIDPipe()) listId: string,
  ) {
    return this.userService.listShoppingListItems(user.userId, listId);
  }

  @Post('lists/:listId/items')
  createItem(
    @CurrentUser() user: JwtUser,
    @Param('listId', new ParseUUIDPipe()) listId: string,
    @Body() dto: CreateShoppingListItemDto,
  ) {
    return this.userService.createShoppingListItem(user.userId, listId, dto);
  }

  @Patch('lists/:listId/items/:itemId')
  updateItem(
    @CurrentUser() user: JwtUser,
    @Param('listId', new ParseUUIDPipe()) listId: string,
    @Param('itemId', new ParseUUIDPipe()) itemId: string,
    @Body() dto: UpdateShoppingListItemDto,
  ) {
    return this.userService.updateShoppingListItem(user.userId, listId, itemId, dto);
  }

  @Delete('lists/:listId/items/:itemId')
  deleteItem(
    @CurrentUser() user: JwtUser,
    @Param('listId', new ParseUUIDPipe()) listId: string,
    @Param('itemId', new ParseUUIDPipe()) itemId: string,
  ) {
    return this.userService.deleteShoppingListItem(user.userId, listId, itemId);
  }
}
