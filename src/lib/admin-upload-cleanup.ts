interface FailedUploadCleanupOptions {
  uploadedPaths: readonly string[];
  retainedPaths?: readonly (string | null | undefined)[];
  isOwnedPath: (path: string) => boolean;
}

export function failedAdminUploadCleanupCandidates({
  uploadedPaths,
  retainedPaths = [],
  isOwnedPath,
}: FailedUploadCleanupOptions): string[] {
  const retained = new Set(
    retainedPaths.filter((path): path is string => Boolean(path)),
  );

  return [...new Set(uploadedPaths)].filter(
    (path) => isOwnedPath(path) && !retained.has(path),
  );
}
