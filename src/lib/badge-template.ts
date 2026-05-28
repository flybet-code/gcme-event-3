const DEFAULT_PUBLIC_SRC = '/badge_template.jpg';

export function getDefaultBadgeTemplateSrc(): string {
    return DEFAULT_PUBLIC_SRC;
}

/**
 * Resolve the badge background URL used in <img src> (relative to site origin).
 */
export function resolveBadgeTemplateSrcFromSettings(settings: unknown): string {
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
        return DEFAULT_PUBLIC_SRC;
    }
    const url = (settings as { badgeTemplateUrl?: unknown }).badgeTemplateUrl;
    if (typeof url === 'string' && url.trim().length > 0) {
        return url.trim();
    }
    return DEFAULT_PUBLIC_SRC;
}

export { DEFAULT_PUBLIC_SRC };
