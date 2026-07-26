jest.mock('electron');
jest.mock('./ai-settings');
jest.mock('../ai/models');
jest.mock('../ai/generate-description');

import { ipcMain } from 'electron';
import { CHANNELS } from '@shared/ipc-types';
import type { GenerateDescriptionRequest } from '@shared/ipc-types';
import { registerGenerateDescriptionHandlers } from './generate-description';
import { readStoredApiKey, readStoredModelTier } from './ai-settings';
import { resolvePrimaryModel } from '../ai/models';
import { runGenerateDescription } from '../ai/generate-description';

function getHandler(channel: string) {
  const call = (ipcMain.handle as jest.Mock).mock.calls.find(([ch]) => ch === channel);
  if (!call) throw new Error(`No handler registered for ${channel}`);
  return call[1] as (event: unknown, arg: unknown) => Promise<unknown> | unknown;
}

function request(): GenerateDescriptionRequest {
  return {
    shelter: {
      name: 'Aeolus View Camp', architecture: '', built_by: '', description: '', notes: '',
      start_year: 1932, end_year: null, is_extant: true, is_gmc: true, category: 'Shelter',
    },
    historyContent: '',
  };
}

describe('ipc/generate-description', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (readStoredModelTier as jest.Mock).mockReturnValue('default');
    (resolvePrimaryModel as jest.Mock).mockReturnValue('claude-haiku-4-5-20251001');
    registerGenerateDescriptionHandlers();
  });

  it('returns no_api_key without calling runGenerateDescription when no key is stored', async () => {
    (readStoredApiKey as jest.Mock).mockReturnValue('');
    const handle = getHandler(CHANNELS.SHELTER_GENERATE_DESCRIPTION);

    const result = await handle(null, request());

    expect(result).toEqual({ ok: false, error: 'no_api_key' });
    expect(runGenerateDescription).not.toHaveBeenCalled();
  });

  it('resolves the model from the stored tier and forwards the request to runGenerateDescription', async () => {
    (readStoredApiKey as jest.Mock).mockReturnValue('sk-ant-key');
    (runGenerateDescription as jest.Mock).mockResolvedValue({ ok: true, description: 'A lovely lean-to.' });
    const handle = getHandler(CHANNELS.SHELTER_GENERATE_DESCRIPTION);

    const req = request();
    const result = await handle(null, req);

    expect(resolvePrimaryModel).toHaveBeenCalledWith('default');
    expect(runGenerateDescription).toHaveBeenCalledWith('sk-ant-key', 'claude-haiku-4-5-20251001', req);
    expect(result).toEqual({ ok: true, description: 'A lovely lean-to.' });
  });
});
