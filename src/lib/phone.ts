/**
 * Normalizes an Ethiopian phone number to its core 9 digits (starting with 9).
 * Handles formats: 9..., 09..., +2519..., 2519...
 */
export function normalizePhone(phone: string): string | null {
    if (!phone) return null;

    // Remove all non-numeric characters except +
    const cleaned = phone.replace(/[^\d+]/g, '');

    // Extract core 8 digits from the end (Ethiopian subscriber number part)
    if (cleaned.length >= 8) {
        return cleaned.slice(-8);
    }

    return cleaned;
}

/**
 * Returns an array of search patterns for a given phone number input.
 * It focuses on the last 8 digits to ignore various prefixes (+251, 09, 2519, etc.)
 */
export function getPhoneVariations(input: string): string[] {
    const cleaned = input.replace(/[^\d+]/g, '');

    // If we have at least 8 digits, use the last 8 as the primary search token
    if (cleaned.length >= 8) {
        const subscriberCore = cleaned.slice(-8);
        return [subscriberCore]; // Searching for the core 8 digits will match all prefix variations
    }

    return [input];
}

/**
 * Returns common string formats for a phone number so we can look up existing
 * registrations regardless of how the number was stored (09..., 9..., +251..., etc.)
 */
export function getPhoneFormatsForLookup(phone: string): string[] {
    const core = normalizePhone(phone);
    if (!core || core.length < 8) return phone ? [phone.trim()] : [];

    // Ethiopian mobile: 9 XX XXX XXXX (9 digits). Core 8 = last 8 of that.
    const with9 = `9${core}`; // 9xxxxxxxx
    return [
        core,
        with9,
        `0${with9}`,
        `251${with9}`,
        `+251${with9}`,
        `251${core}`,
        `+251${core}`,
    ].filter(Boolean);
}
