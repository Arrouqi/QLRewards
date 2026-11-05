import type { OfferQaDetails, OfferQaOptions } from "@shared/offerQaDetails";

type Selections = Pick<OfferQaDetails, "categoryIds" | "subCategoryIds" | "branchIds" | "claimRuleIds" | "paymentConditionIds">
  & { offerTypeId: number | null; parentMerchantProfileId: string };

export function isRealOfferParentId(value: string | null | undefined): value is string {
  return !!value && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value));
}

export function offerQaSelectionIssues(draft: Selections, options: OfferQaOptions): string[] {
  const problems: string[] = [];
  if (draft.categoryIds.some((id) => !options.categories.some((category) => category.id === id))) problems.push("Reselect categories that are no longer available in QA.");
  if (draft.subCategoryIds.some((id) => !options.categories.some((category) => draft.categoryIds.includes(category.id) && category.subCategories.some((sub) => sub.id === id)))) problems.push("Reselect subcategories belonging to the selected categories.");
  if (draft.offerTypeId !== null && !options.offerTypes.some((item) => item.id === draft.offerTypeId)) problems.push("Reselect an available QA offer type.");
  if (draft.claimRuleIds.some((id) => !options.claimRules.some((item) => item.id === id))) problems.push("Remove or reselect unavailable claim rules.");
  if (draft.paymentConditionIds.some((id) => !options.paymentConditions.some((item) => item.id === id))) problems.push("Remove or reselect unavailable payment conditions.");
  if (draft.branchIds.some((id) => !options.branches.some((item) => item.id === id))) problems.push("Reselect branches belonging to the current QA merchant.");
  return problems;
}

export function clearUnavailableOfferQaSelections<T extends Selections>(draft: T, options: OfferQaOptions): T {
  const categoryIds = draft.categoryIds.filter((id) => options.categories.some((item) => item.id === id));
  return {
    ...draft, categoryIds,
    subCategoryIds: draft.subCategoryIds.filter((id) => options.categories.some((category) => categoryIds.includes(category.id) && category.subCategories.some((sub) => sub.id === id))),
    offerTypeId: options.offerTypes.some((item) => item.id === draft.offerTypeId) ? draft.offerTypeId : null,
    branchIds: draft.branchIds.filter((id) => options.branches.some((item) => item.id === id)),
    claimRuleIds: draft.claimRuleIds.filter((id) => options.claimRules.some((item) => item.id === id)),
    paymentConditionIds: draft.paymentConditionIds.filter((id) => options.paymentConditions.some((item) => item.id === id)),
  };
}

export type OfferQaSaveState = {
  initialized: boolean;
  locked: boolean;
  editable: boolean;
  editBlockedReason?: string | null;
  saving: boolean;
  uploadsPending: boolean;
  parentId: string | null | undefined;
  draft: Selections;
  options?: OfferQaOptions;
  optionsLoading: boolean;
  optionsFetching: boolean;
  optionsError: boolean;
  hasSavedDetails: boolean;
  dirty: boolean;
};

export function offerQaSaveBlockers(state: OfferQaSaveState): string[] {
  const reasons: string[] = [];
  if (!state.initialized) reasons.push("Wait for offer setup to finish loading.");
  if (state.locked) reasons.push("This offer is already linked to QA and its setup is read only.");
  else if (!state.editable) reasons.push(state.editBlockedReason || "This offer's current status or uncertain QA link prevents editing. Reload offer details to check its state.");
  if (state.saving) reasons.push("Wait for the current save to finish.");
  if (state.uploadsPending) reasons.push("Wait for QA image uploads to finish before saving.");
  if (!isRealOfferParentId(state.parentId)) reasons.push("Create or link a real QA merchant before saving offer setup.");
  else if (state.draft.parentMerchantProfileId !== state.parentId) reasons.push("The QA merchant link changed. Review for the current merchant, then reselect its branches.");
  if (state.optionsLoading || state.optionsFetching) reasons.push("Wait for QA options and branches to finish loading.");
  else if (state.optionsError || !state.options) reasons.push("QA options could not be verified. Reload QA options and branches.");
  else if (state.options.merchantProfileId !== state.parentId) reasons.push("QA options belong to a different merchant. Reload QA options and branches.");
  else {
    if (state.options.branchIssue) reasons.push(state.options.branchIssue);
    else if (!state.options.branches.length) reasons.push("The linked QA merchant has no selectable branches. Add its actual branches in QA, then reload.");
    reasons.push(...offerQaSelectionIssues(state.draft, state.options));
  }
  if (state.hasSavedDetails && !state.dirty) reasons.push("No unsaved changes. This offer setup is already saved.");
  return reasons;
}
