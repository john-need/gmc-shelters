import { ipcMain } from 'electron';
import { CHANNELS } from '../../shared/ipc-types';
import { getPhotosByShelter, updatePhoto, deletePhoto, setDefaultPhoto, insertPhoto } from '../db/photos';
import { getShelterById } from '../db/shelters';
import { copyPhotoToShelter, deletePhotoFile } from '../fs/photos';
import type { PhotoUpdateInput, PhotoUploadInput } from '../../shared/ipc-types';

export function registerPhotoHandlers(): void {
  ipcMain.handle(
    CHANNELS.PHOTOS_GET_BY_SHELTER,
    (_e, { shelterId }: { shelterId: number }) => getPhotosByShelter(shelterId),
  );

  ipcMain.handle(CHANNELS.PHOTOS_UPDATE, (_e, input: PhotoUpdateInput & { id: number; shelter_id: number }) =>
    updatePhoto(input),
  );

  ipcMain.handle(CHANNELS.PHOTOS_DELETE, async (_e, { id }: { id: number }) => {
    const photos = getPhotosByShelter(0); // we need shelter_id from the photo record
    // fetch the photo to get its file_name and shelter_id before deleting
    const { getDb } = await import('../db/connection');
    const db = getDb();
    const photo = db.prepare('SELECT shelter_id, file_name FROM photos WHERE id = ?').get(id) as
      | { shelter_id: number; file_name: string }
      | undefined;

    if (photo) {
      const shelter = getShelterById(photo.shelter_id);
      if (shelter) {
        await deletePhotoFile(shelter.slug, photo.file_name);
      }
    }
    void photos;
    deletePhoto(id);
  });

  ipcMain.handle(
    CHANNELS.PHOTOS_SET_DEFAULT,
    (_e, { shelterId, photoId }: { shelterId: number; photoId: number }) =>
      setDefaultPhoto(shelterId, photoId),
  );

  ipcMain.handle(CHANNELS.PHOTOS_UPLOAD, async (_e, input: PhotoUploadInput) => {
    const shelter = getShelterById(input.shelterId);
    if (!shelter) throw new Error(`Shelter ${input.shelterId} not found`);

    const fileName = await copyPhotoToShelter(input.sourcePath, shelter.slug);
    return insertPhoto(input.shelterId, fileName, input.title);
  });
}
