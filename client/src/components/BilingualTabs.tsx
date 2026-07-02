import { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface BilingualTabsProps {
  idPrefix: string;
  english: ReactNode;
  arabic: ReactNode;
  hasEnglishError?: boolean;
  hasArabicError?: boolean;
  className?: string;
}

export function BilingualTabs({
  idPrefix,
  english,
  arabic,
  hasEnglishError,
  hasArabicError,
  className,
}: BilingualTabsProps) {
  const { t } = useTranslation("common");

  return (
    <Tabs defaultValue="en" className={cn("w-full", className)}>
      <TabsList className="h-8 mb-1" data-testid={`tabs-bilingual-${idPrefix}`}>
        <TabsTrigger
          value="en"
          className="h-6 px-3 text-xs gap-1.5"
          data-testid={`tab-en-${idPrefix}`}
        >
          {t("language.english")}
          {hasEnglishError && (
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-destructive" aria-hidden="true" />
          )}
        </TabsTrigger>
        <TabsTrigger
          value="ar"
          className="h-6 px-3 text-xs gap-1.5"
          data-testid={`tab-ar-${idPrefix}`}
        >
          {t("language.arabic")}
          {hasArabicError && (
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-destructive" aria-hidden="true" />
          )}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="en" forceMount className="mt-0 data-[state=inactive]:hidden">
        {english}
      </TabsContent>
      <TabsContent value="ar" forceMount className="mt-0 data-[state=inactive]:hidden">
        {arabic}
        <p className="mt-1.5 text-xs text-amber-600" data-testid={`text-accuracy-note-${idPrefix}`}>
          {t("bilingual.accuracyNote")}
        </p>
      </TabsContent>
    </Tabs>
  );
}
