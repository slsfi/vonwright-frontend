import { Pipe, PipeTransform, inject, LOCALE_ID } from '@angular/core';


/**
 * Transforms a BCP-47 language code (e.g. "en", "sv", "pt-BR") into a localized,
 * human-readable language name using `Intl.DisplayNames`.
 *
 * The display locale defaults to Angular’s `LOCALE_ID`, but you can override it
 * by passing a second argument to the pipe. Results are cached per locale for
 * performance.
 * 
 * If `Intl.DisplayNames` is unavailable (e.g., minimal ICU/SSR), or the provided
 * code is an invalid language code, the pipe falls back to returning the
 * original code.
 *
 * Usage (UI locale-aware):
 *   {{ 'en' | langName }}  // "Engelska" when LOCALE_ID='sv', "English" when 'en'
 *
 * Usage (autonym/self-name):
 *   {{ code | langName: code }}  // e.g., 'de' -> "Deutsch" regardless of UI locale
 *
 * Notes:
 * - Underscores are normalized to hyphens (e.g. "pt_BR" → "pt-br").
 * - Regional/Script tags like "pt-BR", "zh-Hant-TW" are supported.
 * - SSR: safe; without `Intl.DisplayNames`, the code is returned unchanged.
 *
 * @param code      Language code to display (e.g. "en", "sv", "pt-BR").
 * @param localeArg Optional override for the display locale; defaults to `LOCALE_ID`.
 * @returns         Localized language name, or the original code as a fallback.
 */
@Pipe({ name: 'langName' })
export class LangNamePipe implements PipeTransform {
  private readonly localeId = inject(LOCALE_ID);

  private cache = new Map<string, Intl.DisplayNames | null>();

  private getDN(locale: string): Intl.DisplayNames | null {
    const Ctor = (Intl as any).DisplayNames as
      | (new (loc: string | string[], opts: any) => Intl.DisplayNames)
      | undefined;

    if (typeof Ctor !== 'function') return null;

    if (!this.cache.has(locale)) {
      const dn = new Ctor(locale, {
        type: 'language',
        languageDisplay: 'standard',  // or 'dialect' if you prefer
        fallback: 'code'
      });
      this.cache.set(locale, dn);
    }
    return this.cache.get(locale)!;
  }

  transform(code?: string | null, localeArg?: string): string {
    if (!code) return $localize`:@@Language.Undefined:odefinierat`;
    const raw = String(code);  // preserve original for fallback
    const locale = (localeArg ?? this.localeId) as string;
    const normalized = raw.replace('_', '-').toLowerCase();

    const dn = this.getDN(locale);
    // If DisplayNames returns something different from our normalized tag, use it.
    // Otherwise (no support/unknown/invalid), return the original input unchanged.
    const name = dn?.of(normalized);
    return name && name !== normalized ? name : raw;
  }
}
