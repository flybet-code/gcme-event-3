export function badgeImageFilename(badgeId: string, fullName: string): string {
    const safeName = fullName
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '_')
        .slice(0, 48) || 'attendee';
    return `badge_${safeName}_${badgeId.replace(/[^a-zA-Z0-9-_]/g, '_')}.png`;
}

function triggerBlobDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}

export async function downloadBadgeImageFile(badgeId: string, fullName: string): Promise<void> {
    const res = await fetch(`/api/badges/image?badgeId=${encodeURIComponent(badgeId)}`, {
        credentials: 'include',
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || 'Failed to download badge image');
    }
    const blob = await res.blob();
    triggerBlobDownload(blob, badgeImageFilename(badgeId, fullName));
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function downloadBadgeImagesBatch(
    items: { id: string; fullName: string }[],
    onProgress?: (completed: number, total: number) => void
): Promise<void> {
    const total = items.length;
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        await downloadBadgeImageFile(item.id, item.fullName);
        onProgress?.(i + 1, total);
        if (i < items.length - 1) {
            await delay(350);
        }
    }
}
