import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateShoppingListItemDto } from './dto/create-shopping-list-item.dto';
import { CreateShoppingListDto } from './dto/create-shopping-list.dto';
import { UpdateShoppingListItemDto } from './dto/update-shopping-list-item.dto';
import { UpdateShoppingListDto } from './dto/update-shopping-list.dto';

type ShoppingListRow = {
  id: string;
  user_id: string;
  name: string;
  status: 'active' | 'archived' | 'completed';
  created_at: string;
  updated_at: string;
};

type ShoppingListItemRow = {
  id: string;
  list_id: string;
  raw_text: string;
  quantity: string;
  unit: string | null;
  checked: boolean;
  created_at: string;
};

@Injectable()
export class UserService {
  constructor(private readonly db: DatabaseService) {}

  async createShoppingList(userId: string, dto: CreateShoppingListDto) {
    const result = await this.db.query<ShoppingListRow>(
      `
      INSERT INTO shopping_lists (user_id, name, status)
      VALUES ($1, $2, 'active')
      RETURNING id, user_id, name, status, created_at, updated_at
      `,
      [userId, dto.name.trim()],
    );

    return result.rows[0];
  }

  async listShoppingLists(userId: string) {
    const result = await this.db.query<ShoppingListRow>(
      `
      SELECT id, user_id, name, status, created_at, updated_at
      FROM shopping_lists
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 100
      `,
      [userId],
    );

    return result.rows;
  }

  async updateShoppingList(
    userId: string,
    listId: string,
    dto: UpdateShoppingListDto,
  ): Promise<ShoppingListRow> {
    await this.assertListOwnership(userId, listId);

    if (!dto.name && !dto.status) {
      throw new BadRequestException('Nothing to update.');
    }

    if (dto.status && !['active', 'archived', 'completed'].includes(dto.status)) {
      throw new BadRequestException('Invalid list status.');
    }

    const result = await this.db.query<ShoppingListRow>(
      `
      UPDATE shopping_lists
      SET
        name = COALESCE($3, name),
        status = COALESCE($4, status),
        updated_at = NOW()
      WHERE id = $1
        AND user_id = $2
      RETURNING id, user_id, name, status, created_at, updated_at
      `,
      [listId, userId, dto.name?.trim() ?? null, dto.status ?? null],
    );

    return result.rows[0];
  }

  async deleteShoppingList(userId: string, listId: string): Promise<{ deleted: true }> {
    await this.assertListOwnership(userId, listId);

    await this.db.query(
      `
      DELETE FROM shopping_lists
      WHERE id = $1
        AND user_id = $2
      `,
      [listId, userId],
    );

    return { deleted: true };
  }

  async listShoppingListItems(
    userId: string,
    listId: string,
  ): Promise<ShoppingListItemRow[]> {
    await this.assertListOwnership(userId, listId);

    const result = await this.db.query<ShoppingListItemRow>(
      `
      SELECT id, list_id, raw_text, quantity, unit, checked, created_at
      FROM shopping_list_items
      WHERE list_id = $1
      ORDER BY created_at ASC
      `,
      [listId],
    );

    return result.rows;
  }

  async createShoppingListItem(
    userId: string,
    listId: string,
    dto: CreateShoppingListItemDto,
  ): Promise<ShoppingListItemRow> {
    await this.assertListOwnership(userId, listId);

    const quantity = dto.quantity ?? 1;
    if (quantity <= 0) {
      throw new BadRequestException('Quantity must be greater than zero.');
    }

    const result = await this.db.query<ShoppingListItemRow>(
      `
      INSERT INTO shopping_list_items (list_id, raw_text, quantity, unit, checked)
      VALUES ($1, $2, $3, $4, false)
      RETURNING id, list_id, raw_text, quantity, unit, checked, created_at
      `,
      [listId, dto.raw_text.trim(), quantity, dto.unit ?? null],
    );

    return result.rows[0];
  }

  async updateShoppingListItem(
    userId: string,
    listId: string,
    itemId: string,
    dto: UpdateShoppingListItemDto,
  ): Promise<ShoppingListItemRow> {
    await this.assertListOwnership(userId, listId);
    await this.assertItemBelongsToList(listId, itemId);

    if (
      dto.raw_text === undefined &&
      dto.quantity === undefined &&
      dto.unit === undefined &&
      dto.checked === undefined
    ) {
      throw new BadRequestException('Nothing to update.');
    }

    if (dto.quantity !== undefined && dto.quantity <= 0) {
      throw new BadRequestException('Quantity must be greater than zero.');
    }

    const result = await this.db.query<ShoppingListItemRow>(
      `
      UPDATE shopping_list_items
      SET
        raw_text = COALESCE($3, raw_text),
        quantity = COALESCE($4, quantity),
        unit = COALESCE($5, unit),
        checked = COALESCE($6, checked)
      WHERE id = $1
        AND list_id = $2
      RETURNING id, list_id, raw_text, quantity, unit, checked, created_at
      `,
      [
        itemId,
        listId,
        dto.raw_text?.trim() ?? null,
        dto.quantity ?? null,
        dto.unit ?? null,
        dto.checked ?? null,
      ],
    );

    return result.rows[0];
  }

  async deleteShoppingListItem(
    userId: string,
    listId: string,
    itemId: string,
  ): Promise<{ deleted: true }> {
    await this.assertListOwnership(userId, listId);
    await this.assertItemBelongsToList(listId, itemId);

    await this.db.query(
      `
      DELETE FROM shopping_list_items
      WHERE id = $1
        AND list_id = $2
      `,
      [itemId, listId],
    );

    return { deleted: true };
  }

  private async assertListOwnership(userId: string, listId: string): Promise<void> {
    const result = await this.db.query<{ id: string }>(
      `
      SELECT id
      FROM shopping_lists
      WHERE id = $1
        AND user_id = $2
      LIMIT 1
      `,
      [listId, userId],
    );

    if (!result.rows[0]) {
      throw new NotFoundException('Shopping list not found for current user.');
    }
  }

  private async assertItemBelongsToList(listId: string, itemId: string): Promise<void> {
    const result = await this.db.query<{ id: string }>(
      `
      SELECT id
      FROM shopping_list_items
      WHERE id = $1
        AND list_id = $2
      LIMIT 1
      `,
      [itemId, listId],
    );

    if (!result.rows[0]) {
      throw new NotFoundException('Shopping list item not found.');
    }
  }
}
