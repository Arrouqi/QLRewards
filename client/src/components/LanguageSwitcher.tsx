import { useTranslation } from "react-i18next";
import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ className }: { className?: string }) {
  const { i18n } = useTranslation();
  const isArabic = (i18n.language || "en").split("-")[0] === "ar";

  const toggle = () => {
    i18n.changeLanguage(isArabic ? "en" : "ar");
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={toggle}
      data-testid="button-language-switcher"
      className={cn("gap-2", className)}
    >
      <Languages className="h-4 w-4" />
      {isArabic ? "English" : "العربية"}
    </Button>
  );
}
