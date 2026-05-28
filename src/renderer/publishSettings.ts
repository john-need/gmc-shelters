export const DEFAULT_PUBLISHING = {
  ROOT_FOLDER_ID: '',
  MANIFEST_NAME: 'shelter-manifest.json',
  SCOPES: ['https://www.googleapis.com/auth/drive'],
};

export type StoredPublishing = typeof DEFAULT_PUBLISHING;

export function loadStoredPublishing(): StoredPublishing {
  try {
    const stored = localStorage.getItem('gmc.publishing');
    return stored ? { ...DEFAULT_PUBLISHING, ...JSON.parse(stored) } : { ...DEFAULT_PUBLISHING };
  } catch {
    return { ...DEFAULT_PUBLISHING };
  }
}
