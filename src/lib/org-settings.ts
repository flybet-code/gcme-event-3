/** Key stored in Organization.settings JSON for the form suggested for new events. */
export const DEFAULT_REGISTRATION_FORM_ID_KEY = 'defaultRegistrationFormId';

export function getDefaultRegistrationFormIdFromSettings(settings: unknown): string | null {
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return null;
    const v = (settings as Record<string, unknown>)[DEFAULT_REGISTRATION_FORM_ID_KEY];
    if (typeof v !== 'string' || !v.trim()) return null;
    return v.trim();
}
