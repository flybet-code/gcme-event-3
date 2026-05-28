import { toBuffer } from 'qrcode';
import sharp from 'sharp';
import { getDefaultBadgeTemplateSrc } from '@/lib/badge-template';
import { resolveBadgeTemplateForSharp } from '@/lib/badge-template-server';

function escapeSvgText(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/** Split name into lines that fit on the badge (≈16 chars per line at 60px font). */
function wrapNameForBadge(fullName: string, maxCharsPerLine: number = 16): string[] {
    const trimmed = fullName.trim().toUpperCase();
    if (!trimmed) return [''];
    const words = trimmed.split(/\s+/);
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
        const next = current ? `${current} ${word}` : word;
        if (next.length <= maxCharsPerLine) {
            current = next;
        } else {
            if (current) lines.push(current);
            current = word.length <= maxCharsPerLine ? word : word.slice(0, maxCharsPerLine);
        }
    }
    if (current) lines.push(current);
    return lines.length ? lines : [trimmed];
}

/**
 * Generate a badge PNG using Sharp (same output as confirmation emails).
 */
export async function generateBadgeImage(
    fullName: string,
    ticketNo: string,
    qrData: string,
    templateSrc: string = getDefaultBadgeTemplateSrc()
): Promise<Buffer> {
    const templateInput = await resolveBadgeTemplateForSharp(templateSrc);

    const qrBuffer = await toBuffer(qrData, {
        width: 216,
        margin: 1,
        color: {
            dark: '#FFFFFF',
            light: '#00000000',
        },
    });

    const nameLines = wrapNameForBadge(fullName);
    const lineHeight = 70;
    const nameStartY = 340 - ((nameLines.length - 1) * lineHeight) / 2;
    const nameTsps = nameLines
        .map(
            (line, i) =>
                `<tspan x="745" ${i === 0 ? `y="${nameStartY}"` : `dy="${lineHeight}"`} class="title">${escapeSvgText(line)}</tspan>`
        )
        .join('');
    const svgText = `
        <svg width="1080" height="681">
            <style>
                .title { fill: #5D2E17; font-size: 50px; font-family: 'Noto Sans Ethiopic', 'DejaVu Sans', Arial, sans-serif; font-weight: 900; text-anchor: middle; text-transform: uppercase; }
                .ticket { fill: #fff; font-size: 36px; font-family: 'Noto Sans Ethiopic', 'DejaVu Sans Mono', monospace; font-weight: bold; letter-spacing: 0.2em; text-anchor: end; }
            </style>
            <text class="title">${nameTsps}</text>
            <text x="1058" y="92" class="ticket">${escapeSvgText(ticketNo)}</text>
        </svg>
        `;

    return sharp(templateInput)
        .resize(1080, 681)
        .composite([
            { input: qrBuffer, top: 400, left: 103 },
            { input: Buffer.from(svgText), top: 0, left: 0 },
        ])
        .png()
        .toBuffer();
}
