import { ipcMain } from 'electron';
import { CHANNELS } from '../../shared/ipc-types';
import {
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../db/categories';
import type { Category, CategoryInput } from '../../shared/ipc-types';

export function registerCategoryHandlers(): void {
  ipcMain.handle(CHANNELS.CATEGORIES_GET_ALL, () => getAllCategories());

  ipcMain.handle(CHANNELS.CATEGORIES_CREATE, (_e, input: CategoryInput) =>
    createCategory(input),
  );

  ipcMain.handle(CHANNELS.CATEGORIES_UPDATE, (_e, cat: Category) =>
    updateCategory(cat),
  );

  ipcMain.handle(
    CHANNELS.CATEGORIES_DELETE,
    (_e, { id, reassignTo }: { id: number; reassignTo?: string }) =>
      deleteCategory(id, reassignTo),
  );
}
