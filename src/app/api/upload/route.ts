import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import sharp from 'sharp';

// App Router route handlers do not enforce a body size limit by default,
// but we make it explicit and disable static optimization since we always
// process a streamed multipart body.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function isAllowedUploadOrigin(origin: string | null): boolean {
    if (!origin) return true;
    try {
        const u = new URL(origin);
        if (process.env.NODE_ENV === 'development') {
            return u.hostname === 'localhost' || u.hostname === '127.0.0.1';
        }
        const allowed = [
            'https://event.dsethiopia.org',
            'http://localhost:3000',
            'http://localhost:3001',
        ];
        if (process.env.NEXT_PUBLIC_APP_URL) {
            allowed.push(process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, ''));
        }
        const o = origin.replace(/\/$/, '');
        return allowed.some((a) => o === a || o.startsWith(a + '/'));
    } catch {
        return false;
    }
}

export async function POST(request: NextRequest) {
    try {
        // Public endpoint: anonymous users (e.g. event registrants uploading
        // payment receipts) must be able to upload. CSRF/abuse protection is
        // provided by the origin check + file-extension allow-list below.
        const origin = request.headers.get('origin');
        if (origin && !isAllowedUploadOrigin(origin)) {
            return NextResponse.json({ error: 'Forbidden: Invalid Request Origin' }, { status: 403 });
        }

        const data = await request.formData();
        const file: File | null = data.get('file') as unknown as File;

        if (!file) {
            return NextResponse.json(
                { success: false, message: 'No file uploaded' },
                { status: 400 }
            );
        }

        const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'webp'];
        const fileExtension = file.name.split('.').pop()?.toLowerCase();

        if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
            return NextResponse.json(
                { success: false, message: 'Invalid file type. Only images and PDFs are allowed.' },
                { status: 400 }
            );
        }

        // No file size limit — accept files of any size.

        const bytes = await file.arrayBuffer();
        let buffer = Buffer.from(bytes);
        const originalSize = buffer.length;

        // Optimize images using sharp (compress and resize if needed). This is
        // best-effort: failures fall back to the original buffer so very large
        // or unusual images still upload successfully.
        const imageExtensions = ['jpg', 'jpeg', 'png', 'webp'];
        if (imageExtensions.includes(fileExtension)) {
            try {
                const image = sharp(buffer, { limitInputPixels: false });
                const metadata = await image.metadata();

                const MAX_DIMENSION = 2000;
                const resizeOptions: { width?: number; height?: number } = {};

                if (metadata.width && metadata.width > MAX_DIMENSION) {
                    resizeOptions.width = MAX_DIMENSION;
                } else if (metadata.height && metadata.height > MAX_DIMENSION) {
                    resizeOptions.height = MAX_DIMENSION;
                }

                const hasResize = !!(resizeOptions.width || resizeOptions.height);

                if (fileExtension === 'png') {
                    buffer = await image
                        .resize(hasResize ? resizeOptions : undefined)
                        .png({ quality: 85, compressionLevel: 8 })
                        .toBuffer();
                } else if (fileExtension === 'webp') {
                    buffer = await image
                        .resize(hasResize ? resizeOptions : undefined)
                        .webp({ quality: 85 })
                        .toBuffer();
                } else {
                    buffer = await image
                        .resize(hasResize ? resizeOptions : undefined)
                        .jpeg({ quality: 85, mozjpeg: true })
                        .toBuffer();
                }

                console.log(
                    `Image optimized: ${(originalSize / 1024).toFixed(2)}KB → ${(buffer.length / 1024).toFixed(2)}KB`
                );
            } catch (error) {
                console.error('Image optimization failed, using original:', error);
                buffer = Buffer.from(bytes);
            }
        }

        const uploadDir = join(process.cwd(), 'uploads');

        try {
            await mkdir(uploadDir, { recursive: true });
        } catch {
            // Directory already exists — ignore.
        }

        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const filename = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
        const uniqueFilename = `${uniqueSuffix}-${filename}`;
        const filePath = join(uploadDir, uniqueFilename);

        await writeFile(filePath, buffer);

        const fileUrl = `/api/uploads/${uniqueFilename}`;

        return NextResponse.json({
            success: true,
            filePath: fileUrl
        });

    } catch (error) {
        console.error('CRITICAL: Error uploading file:', error);
        return NextResponse.json(
            {
                success: false,
                message: 'Upload failed',
                error: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
}
