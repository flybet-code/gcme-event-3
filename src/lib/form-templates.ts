/** Stored on `Form.i18nMeta` to select the full GLS summit UI instead of `DynamicForm`. */
export const SUMMIT_LEGACY_UI_TEMPLATE = 'summit_legacy' as const;

export type FormI18nMeta = {
    uiTemplate?: typeof SUMMIT_LEGACY_UI_TEMPLATE | string;
    [key: string]: unknown;
};

export function getSummitLegacyI18nMeta(): FormI18nMeta {
    return { uiTemplate: SUMMIT_LEGACY_UI_TEMPLATE };
}

export function isSummitLegacyForm(form: { i18nMeta?: unknown } | null | undefined): boolean {
    if (!form?.i18nMeta || typeof form.i18nMeta !== 'object' || Array.isArray(form.i18nMeta)) {
        return false;
    }
    const t = (form.i18nMeta as FormI18nMeta).uiTemplate;
    return t === SUMMIT_LEGACY_UI_TEMPLATE;
}
