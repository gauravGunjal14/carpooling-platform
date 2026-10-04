import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { AppError } from '../utils/appError.js';

type UploadedDocument = { buffer: Buffer; size: number; mimetype: string };

const storageDirectory = fileURLToPath(
    new URL('../../private-uploads/', import.meta.url),
);
const maxDocumentSize = 5 * 1024 * 1024;
const allowedTypes = {
    'application/pdf': {
        extension: 'pdf',
        signature: (data: Buffer) => data.subarray(0, 5).toString() === '%PDF-',
    },
    'image/jpeg': {
        extension: 'jpg',
        signature: (data: Buffer) =>
            data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff,
    },
    'image/png': {
        extension: 'png',
        signature: (data: Buffer) =>
            data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    },
} as const;

export type StoredDocument = {
    storageKey: string;
    contentType: keyof typeof allowedTypes;
    sizeBytes: number;
    sha256: string;
};

export async function storePrivateDocument(
    file: UploadedDocument,
): Promise<StoredDocument> {
    if (file.size === 0 || file.size > maxDocumentSize) {
        throw new AppError(
            413,
            'DOCUMENT_TOO_LARGE',
            'Documents must be smaller than 5 MB.',
        );
    }

    const type = allowedTypes[file.mimetype as keyof typeof allowedTypes];
    if (!type || !type.signature(file.buffer)) {
        throw new AppError(
            400,
            'INVALID_DOCUMENT',
            'Upload a valid PDF, JPEG, or PNG document.',
        );
    }

    const storageKey = `${randomUUID()}.${type.extension}`;
    const path = join(storageDirectory, storageKey);
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    await writeFile(path, file.buffer, { flag: 'wx', mode: 0o600 });

    return {
        storageKey,
        contentType: file.mimetype as keyof typeof allowedTypes,
        sizeBytes: file.size,
        sha256: createHash('sha256').update(file.buffer).digest('hex'),
    };
}

export async function readPrivateDocument(storageKey: string): Promise<Buffer> {
    if (!/^[0-9a-f-]{36}\.(pdf|jpg|png)$/.test(storageKey)) {
        throw new AppError(404, 'DOCUMENT_NOT_FOUND', 'Document not found.');
    }
    try {
        return await readFile(join(storageDirectory, storageKey));
    } catch {
        throw new AppError(404, 'DOCUMENT_NOT_FOUND', 'Document not found.');
    }
}

export async function removePrivateDocument(storageKey: string): Promise<void> {
    try {
        await unlink(join(storageDirectory, storageKey));
    } catch {
        // A missing old file must not prevent a valid resubmission from being saved.
    }
}
