/**
 * Client-side image compression utility
 * Compresses images before upload to reduce file size and upload time
 */

export type CompressionOptions = {
    maxSizeMB?: number;
    maxWidthOrHeight?: number;
    quality?: number;
    fileType?: string;
};

/**
 * Compress an image file in the browser before uploading
 * @param file - The original image file
 * @param options - Compression options
 * @returns Compressed image file
 */
export async function compressImage(
    file: File,
    options: CompressionOptions = {}
): Promise<File> {
    const {
        maxSizeMB = 1, // Target max size in MB
        maxWidthOrHeight = 2000, // Max dimension
        quality = 0.85, // Quality (0-1)
        fileType = file.type,
    } = options;

    // If file is already small enough, return it
    if (file.size <= maxSizeMB * 1024 * 1024) {
        return file;
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const img = new Image();
            
            img.onload = () => {
                // Calculate new dimensions
                let { width, height } = img;
                
                if (width > maxWidthOrHeight || height > maxWidthOrHeight) {
                    if (width > height) {
                        height = (height / width) * maxWidthOrHeight;
                        width = maxWidthOrHeight;
                    } else {
                        width = (width / height) * maxWidthOrHeight;
                        height = maxWidthOrHeight;
                    }
                }

                // Create canvas and draw resized image
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Could not get canvas context'));
                    return;
                }

                // Draw image with better quality
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, width, height);

                // Convert to blob with compression
                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            reject(new Error('Could not compress image'));
                            return;
                        }

                        // Create new file from blob
                        const compressedFile = new File(
                            [blob],
                            file.name,
                            {
                                type: fileType,
                                lastModified: Date.now(),
                            }
                        );

                        console.log(
                            `Image compressed: ${(file.size / 1024).toFixed(2)}KB → ${(compressedFile.size / 1024).toFixed(2)}KB (${((1 - compressedFile.size / file.size) * 100).toFixed(1)}% reduction)`
                        );

                        resolve(compressedFile);
                    },
                    fileType,
                    quality
                );
            };

            img.onerror = () => {
                reject(new Error('Could not load image'));
            };

            img.src = e.target?.result as string;
        };

        reader.onerror = () => {
            reject(new Error('Could not read file'));
        };

        reader.readAsDataURL(file);
    });
}

/**
 * Check if a file is an image
 */
export function isImageFile(file: File): boolean {
    return file.type.startsWith('image/');
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
