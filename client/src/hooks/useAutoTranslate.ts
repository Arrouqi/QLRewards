import { useEffect, useRef } from "react";
import type { UseFormReturn } from "react-hook-form";

/**
 * Auto-fills an Arabic field with a translation of the English field.
 * Rules:
 * - Only fills the Arabic field while it is empty or still holding a previous
 *   auto-translation. The moment the user manually edits the Arabic value,
 *   auto-translation stops (never overrides manual input).
 * - Re-translates whenever the English value changes (debounced), as long as
 *   the Arabic value hasn't been manually set.
 */
export function useAutoTranslate(
  form: UseFormReturn<any>,
  enField: string,
  arField: string,
) {
  const enValue = form.watch(enField);
  const arValue = form.watch(arField);
  const lastAuto = useRef<string | null>(null);
  const manualLock = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Once the Arabic value diverges from what we auto-set (including a manual
  // clear after an edit), lock this field permanently — never auto-write again.
  useEffect(() => {
    if (manualLock.current) return;
    const ar = typeof arValue === "string" ? arValue.trim() : "";
    if (ar && ar !== lastAuto.current) manualLock.current = true;
  }, [arValue]);

  useEffect(() => {
    if (manualLock.current) return;
    const enText = typeof enValue === "string" ? enValue.trim() : "";
    if (!enText) return;

    const currentAr = (form.getValues(arField) || "").trim();
    // Manual value present (not one we set): never override.
    if (currentAr && currentAr !== lastAuto.current) return;

    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/public/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: enText }),
        });
        if (!res.ok) return;
        const data = await res.json();
        const translation = typeof data?.translation === "string" ? data.translation.trim() : "";
        if (!translation) return;
        // Re-check before writing: English unchanged and Arabic still not manual.
        const enNow = (form.getValues(enField) || "").trim();
        if (enNow !== enText) return;
        if (manualLock.current) return;
        const arNow = (form.getValues(arField) || "").trim();
        if (arNow && arNow !== lastAuto.current) return;
        lastAuto.current = translation;
        form.setValue(arField, translation, { shouldValidate: true, shouldDirty: true });
      } catch {
        // Silent failure: user can always type Arabic manually.
      }
    }, 900);

    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enValue]);
}
