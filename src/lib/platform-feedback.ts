export const PLATFORM_EASE_LABELS: Record<'EASY' | 'MEDIUM' | 'HARD', string> = {
    EASY: 'Easy',
    MEDIUM: 'Medium',
    HARD: 'Hard',
};

export type PlatformEaseRating = keyof typeof PLATFORM_EASE_LABELS;
