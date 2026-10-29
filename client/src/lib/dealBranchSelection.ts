// The form uses stable field-array IDs while the server stores branch names.
// Translate only at submission, using the current values rather than the
// field-array snapshot (which does not track edits to branch names).
export function mapDealBranchSelections<T extends { branches?: string[] }>(
  deals: T[],
  branches: { id: string; name: string }[],
  invalidSelectionMessage: string,
): T[] {
  return deals.map((deal) => {
    const selectedIds = new Set(deal.branches ?? []);
    const selectedNames = branches.filter((branch) => selectedIds.has(branch.id)).map((branch) => branch.name);
    if (selectedNames.length !== selectedIds.size || (branches.length > 1 && selectedNames.length === 0)) {
      throw new Error(invalidSelectionMessage);
    }
    return {
      ...deal,
      branches: selectedNames.length ? selectedNames : branches.length === 1 ? [branches[0].name] : [],
    };
  });
}
