import type { FanGroup, TicketQueueEntry } from "./types";

type IdentifierField = "phoneNumber" | "deviceId" | "paymentAccount";
type Identifier = { field: IdentifierField; value: string };

const reasonLabels: Record<IdentifierField, string> = {
  phoneNumber: "phone number",
  deviceId: "device ID",
  paymentAccount: "payment account",
};

function normalize(value: string | null | undefined, field: IdentifierField): string | null {
  if (value == null || !value.trim()) return null;
  const normalized = field === "phoneNumber" ? value.trim().replace(/[\s().-]/g, "") : value.trim();
  return normalized || null;
}

function identifiers(entry: TicketQueueEntry): Identifier[] {
  const values: Identifier[] = [];
  for (const field of ["phoneNumber", "deviceId", "paymentAccount"] as const) {
    const value = normalize(entry[field], field);
    if (value !== null) values.push({ field, value });
  }
  return values;
}

/** Groups eligible entries connected through shared phone, device, or payment identifiers. */
export function groupEligibleEntries(entries: TicketQueueEntry[]): FanGroup[] {
  const parent = entries.map((_, index) => index);
  const size = entries.map(() => 1);
  const find = (index: number): number => {
    let root = index;
    while (parent[root] !== root) root = parent[root];
    while (parent[index] !== index) {
      const next = parent[index];
      parent[index] = root;
      index = next;
    }
    return root;
  };
  const union = (a: number, b: number): void => {
    let rootA = find(a);
    let rootB = find(b);
    if (rootA === rootB) return;
    if (size[rootA] < size[rootB]) [rootA, rootB] = [rootB, rootA];
    parent[rootB] = rootA;
    size[rootA] += size[rootB];
  };

  const owners = new Map<string, number>();
  const connections = new Map<string, number[]>();
  entries.forEach((entry, index) => {
    const seen = new Set<string>();
    for (const identifier of identifiers(entry)) {
      const key = `${identifier.field}:${identifier.value}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const owner = owners.get(key);
      if (owner === undefined) {
        owners.set(key, index);
        connections.set(key, [index]);
      } else {
        union(owner, index);
        connections.get(key)!.push(index);
      }
    }
  });

  const members = new Map<number, { entry: TicketQueueEntry; index: number }[]>();
  entries.forEach((entry, index) => {
    const root = find(index);
    const group = members.get(root) ?? [];
    group.push({ entry, index });
    members.set(root, group);
  });

  const reasons = new Map<number, string[]>();
  for (const [key, indices] of connections) {
    if (indices.length < 2) continue;
    const root = find(indices[0]);
    const field = key.slice(0, key.indexOf(":")) as IdentifierField;
    const accountIds = indices.map((index) => entries[index].id);
    const groupReasons = reasons.get(root) ?? [];
    groupReasons.push(`Shared ${reasonLabels[field]} connects entries: ${accountIds.join(", ")}.`);
    reasons.set(root, groupReasons);
  }

  return [...members.entries()]
    .map(([root, groupEntries]) => {
      const ids = groupEntries.map(({ entry }) => entry.id);
      return {
        id: `group:${JSON.stringify(ids)}`,
        entries: groupEntries.map(({ entry }) => entry),
        representative: null,
        connectionReasons: (reasons.get(root) ?? []).sort(),
      };
    });
}
