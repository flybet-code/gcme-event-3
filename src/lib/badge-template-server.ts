import fs from 'fs';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { getDefaultOrganizationId } from '@/lib/tenancy/active-org-server';
import {
    DEFAULT_PUBLIC_SRC,
    getDefaultBadgeTemplateSrc,
    resolveBadgeTemplateSrcFromSettings,
} from '@/lib/badge-template';

/**
 * Resolve badge background URL for a registration row (org or default org for legacy rows).
 */
export async function getResolvedBadgeTemplateSrcForOrg(
    organizationId: string | null | undefined
): Promise<string> {
    let id = organizationId ?? null;
    if (!id) {
        id = await getDefaultOrganizationId();
    }
    if (!id) {
        return getDefaultBadgeTemplateSrc();
    }
    const org = await prisma.organization.findUnique({
        where: { id },
        select: { settings: true },
    });
    return resolveBadgeTemplateSrcFromSettings(org?.settings);
}

function defaultTemplateDiskPath(): string {
    return path.join(process.cwd(), 'public', 'badge_template.jpg');
}

const UPLOAD_PREFIX = '/api/uploads/';

/**
 * Resolve a template path or buffer for Sharp. Falls back to default JPG on disk if missing.
 */
export async function resolveBadgeTemplateForSharp(templateSrc: string): Promise<string | Buffer> {
    const defaultPath = defaultTemplateDiskPath();

    if (templateSrc === DEFAULT_PUBLIC_SRC || templateSrc === '') {
        return defaultPath;
    }

    if (templateSrc.startsWith(UPLOAD_PREFIX)) {
        const filename = templateSrc.slice(UPLOAD_PREFIX.length).replace(/^\/+/, '');
        if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
            console.warn('[badge-template] invalid upload path, using default');
            return defaultPath;
        }
        const uploadPath = path.join(process.cwd(), 'uploads', filename);
        if (fs.existsSync(uploadPath)) {
            return uploadPath;
        }
        console.warn(`[badge-template] upload not found: ${uploadPath}, using default`);
        return defaultPath;
    }

    if (/^https?:\/\//i.test(templateSrc)) {
        try {
            const res = await fetch(templateSrc);
            if (!res.ok) {
                console.warn(`[badge-template] fetch failed ${res.status}, using default`);
                return defaultPath;
            }
            const buf = Buffer.from(await res.arrayBuffer());
            return buf;
        } catch (e) {
            console.warn('[badge-template] fetch error, using default', e);
            return defaultPath;
        }
    }

    console.warn(`[badge-template] unknown templateSrc ${templateSrc}, using default`);
    return defaultPath;
}
