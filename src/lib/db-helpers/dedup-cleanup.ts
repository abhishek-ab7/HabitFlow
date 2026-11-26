export interface CleanupDuplicateEntitiesParams<T extends { id: string }> {
  entities: T[];
  getKey: (entity: T) => string;
  resolveDuplicate: (existing: T, candidate: T) => { keepId: string; discardId: string };
  remapChildren: (discardId: string, keepId: string) => Promise<void>;
  bulkDelete: (ids: string[]) => Promise<void>;
}

export async function remapForeignKey(
  fetchRows: () => Promise<Array<{ id: string }>>,
  updateRow: (id: string) => Promise<unknown>
): Promise<void> {
  const rows = await fetchRows();
  for (const row of rows) {
    await updateRow(row.id);
  }
}

export async function cleanupDuplicateEntities<T extends { id: string }>(
  params: CleanupDuplicateEntitiesParams<T>
): Promise<number> {
  const seen = new Map<string, T>();
  const duplicates: string[] = [];

  for (const entity of params.entities) {
    const key = params.getKey(entity);
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, entity);
      continue;
    }

    const { keepId, discardId } = params.resolveDuplicate(existing, entity);
    duplicates.push(discardId);
    seen.set(key, keepId === entity.id ? entity : existing);
    await params.remapChildren(discardId, keepId);
  }

  if (duplicates.length > 0) {
    await params.bulkDelete(duplicates);
  }

  return duplicates.length;
}
