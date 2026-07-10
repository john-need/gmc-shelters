jest.mock('electron');
jest.mock('./ai-settings');
jest.mock('../ai/models');
jest.mock('../ai/generate-history');

import { ipcMain } from 'electron';
import { CHANNELS } from '@shared/ipc-types';
import type { GenerateHistoryRequest } from '@shared/ipc-types';
import { registerGenerateHistoryHandlers } from './generate-history';
import { readStoredApiKey, readStoredModelTier } from './ai-settings';
import { resolvePrimaryModel } from '../ai/models';
import { runGenerateHistory } from '../ai/generate-history';

function getHandler() {
  const call = (ipcMain.handle as jest.Mock).mock.calls.find(([ch]) => ch === CHANNELS.HISTORY_GENERATE);
  if (!call) throw new Error('No handler registered for HISTORY_GENERATE');
  return call[1] as (event: unknown, request: GenerateHistoryRequest) => Promise<unknown>;
}

function request(): GenerateHistoryRequest {
  return {
    shelter: {
      name: 'Aeolus View Camp',
      architecture: '',
      built_by: '',
      description: '',
      notes: '',
      start_year: 1932,
      end_year: null,
      is_extant: true,
      is_gmc: true,
      category: 'Shelter',
    },
    citations: [],
    currentHistory: '',
  };
}

describe('ipc/generate-history', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (readStoredModelTier as jest.Mock).mockReturnValue('default');
    (resolvePrimaryModel as jest.Mock).mockReturnValue('claude-haiku-4-5-20251001');
    registerGenerateHistoryHandlers();
  });

  it('returns no_api_key with zero network calls when no key is stored', async () => {
    (readStoredApiKey as jest.Mock).mockReturnValue('');
    const handler = getHandler();

    const result = await handler(null, request());

    expect(result).toEqual({ ok: false, error: 'no_api_key' });
    expect(runGenerateHistory).not.toHaveBeenCalled();
  });

  it('resolves the model and calls runGenerateHistory when a key is stored, returning its outcome unchanged', async () => {
    (readStoredApiKey as jest.Mock).mockReturnValue('sk-ant-test');
    (runGenerateHistory as jest.Mock).mockResolvedValue({ ok: true, narrative: 'A narrative.' });
    const handler = getHandler();
    const req = request();

    const result = await handler(null, req);

    expect(resolvePrimaryModel).toHaveBeenCalledWith('default');
    expect(runGenerateHistory).toHaveBeenCalledWith('sk-ant-test', 'claude-haiku-4-5-20251001', req);
    expect(result).toEqual({ ok: true, narrative: 'A narrative.' });
  });

  it('passes through a runGenerateHistory error response unchanged', async () => {
    (readStoredApiKey as jest.Mock).mockReturnValue('sk-ant-test');
    (runGenerateHistory as jest.Mock).mockResolvedValue({ ok: false, error: 'timeout' });
    const handler = getHandler();

    const result = await handler(null, request());

    expect(result).toEqual({ ok: false, error: 'timeout' });
  });
});
