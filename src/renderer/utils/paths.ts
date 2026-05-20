export function buildPhotoUrl(repoRoot: string, sheltersRoot: string, fileName: string): string {
  if (!repoRoot && !/^([A-Za-z]:[/\\]|\/)/.test(sheltersRoot)) {
    return '';
  }

  const isAbsolute = /^([A-Za-z]:[/\\]|\/)/.test(sheltersRoot);
  const base = isAbsolute
    ? sheltersRoot.replace(/\\/g, '/').replace(/\/$/, '')
    : `${repoRoot.replace(/\\/g, '/').replace(/\/$/, '')}/${sheltersRoot.replace(/\\/g, '/').replace(/\/$/, '')}`;

  const finalFileName = fileName.startsWith('shelters/') ? fileName.replace(/^shelters\//, '') : fileName;
  
  // Encode only the path part to be safe, then prepend the protocol
  // We use three slashes to ensure it's treated as an absolute path with no host
  const fullPath = `/${base}/${finalFileName}`.replace(/\/+/g, '/');
  return `shelter://${encodeURI(fullPath)}`;
}
