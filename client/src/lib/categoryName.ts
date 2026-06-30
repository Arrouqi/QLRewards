import i18n from "@/i18n";

type NamedCategory = { name: string; nameAr?: string | null };

export function getLocalizedCategoryName(cat: NamedCategory | null | undefined): string {
  if (!cat) return "";
  if (i18n.language?.startsWith("ar") && cat.nameAr) return cat.nameAr;
  return cat.name ?? "";
}
