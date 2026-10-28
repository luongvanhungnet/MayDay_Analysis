import { Relation, table } from "./schema";

// Breadth-first traversal avoids the deferred parent/subtype FK cycles.
export function ownershipPath(name: string): Relation[] | null {
  const queue: { name: string; path: Relation[] }[] = [{ name, path: [] }];
  const visited = new Set<string>();
  while (queue.length) {
    const current = queue.shift()!;
    if (current.name === "benhnhan") return current.path;
    if (visited.has(current.name)) continue;
    visited.add(current.name);
    for (const relation of table(current.name).relations)
      queue.push({ name: relation.table, path: [...current.path, relation] });
  }
  return null;
}
