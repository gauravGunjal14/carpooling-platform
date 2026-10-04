import type { Request, RequestHandler } from 'express';
import { z } from 'zod';
import { VerificationSubmission } from '../models/VerificationSubmission.js';
import {
    readPrivateDocument,
    removePrivateDocument,
    storePrivateDocument,
} from '../services/privateDocumentStorage.js';
import {
    documentTypeForRole,
    getOwnVerification,
    getSubmissionDocument,
    listVerificationSubmissions,
    reviewVerificationSubmission,
    submitVerificationDocument,
} from '../services/verificationService.js';
import type { SafeUser } from '../types/auth.js';
import { AppError } from '../utils/appError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { parseBody } from '../utils/validation.js';

const reviewSchema = z
    .object({
        status: z.enum(['approved', 'rejected', 'resubmission_required']),
        reviewNote: z.string().trim().max(500).optional(),
    })
    .strict()
    .superRefine((input, context) => {
        if (input.status !== 'approved' && !input.reviewNote) {
            context.addIssue({
                code: 'custom',
                path: ['reviewNote'],
                message: 'A review note is required when a document is not approved.',
            });
        }
    });

export type UploadedDocument = { buffer: Buffer; size: number; mimetype: string };
type RequestWithDocument = Request & { file?: UploadedDocument };
const maxUploadBytes = 5 * 1024 * 1024;
const maxMultipartBytes = maxUploadBytes + 16 * 1024;

export const uploadDocument: RequestHandler = asyncHandler(
    async (request, _response, next) => {
        const contentType = request.header('content-type') ?? '';
        const boundaryMatch =
            /^multipart\/form-data\s*;\s*boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(
                contentType,
            );
        const boundaryValue = boundaryMatch?.[1] ?? boundaryMatch?.[2];
        if (!boundaryValue || !/^[0-9A-Za-z'()+_,\-./:=?]{1,70}$/.test(boundaryValue)) {
            throw new AppError(
                400,
                'INVALID_UPLOAD',
                'Upload one document using multipart form data.',
            );
        }

        const chunks: Buffer[] = [];
        let totalBytes = 0;
        for await (const chunk of request) {
            const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            totalBytes += data.length;
            if (totalBytes > maxMultipartBytes) {
                throw new AppError(
                    413,
                    'DOCUMENT_TOO_LARGE',
                    'Documents must be smaller than 5 MB.',
                );
            }
            chunks.push(data);
        }

        const body = Buffer.concat(chunks, totalBytes);
        const boundary = Buffer.from(`--${boundaryValue}`);
        const headerStart = boundary.length + 2;
        const headerEnd = body.indexOf(Buffer.from('\r\n\r\n'), headerStart);
        const initialBoundaryValid = body.subarray(0, boundary.length).equals(boundary);
        if (!initialBoundaryValid || headerEnd < 0) {
            throw new AppError(
                400,
                'INVALID_UPLOAD',
                'The uploaded document could not be read.',
            );
        }

        const headers = body.subarray(headerStart, headerEnd).toString('latin1');
        const disposition =
            /^content-disposition:\s*form-data;\s*name="document";\s*filename="[^"]*"\s*$/im.test(
                headers,
            );
        const mime = /^content-type:\s*([^\r\n]+)\s*$/im
            .exec(headers)?.[1]
            ?.trim()
            .toLowerCase();
        if (
            !disposition ||
            !mime ||
            !['application/pdf', 'image/jpeg', 'image/png'].includes(mime)
        ) {
            throw new AppError(
                400,
                'INVALID_DOCUMENT',
                'Upload a PDF, JPEG, or PNG document.',
            );
        }

        const bodyStart = headerEnd + 4;
        const nextBoundary = Buffer.from(`\r\n--${boundaryValue}`);
        const bodyEnd = body.indexOf(nextBoundary, bodyStart);
        if (bodyEnd < bodyStart) {
            throw new AppError(
                400,
                'INVALID_UPLOAD',
                'The uploaded document could not be read.',
            );
        }
        const endingStart = bodyEnd + nextBoundary.length;
        const ending = body.subarray(endingStart, endingStart + 2).toString();
        if (ending !== '--' || body.subarray(endingStart + 2).toString() !== '\r\n') {
            throw new AppError(400, 'INVALID_UPLOAD', 'Submit one document at a time.');
        }
        const fileBuffer = body.subarray(bodyStart, bodyEnd);
        if (fileBuffer.length === 0 || fileBuffer.length > maxUploadBytes) {
            throw new AppError(
                413,
                'DOCUMENT_TOO_LARGE',
                'Documents must be smaller than 5 MB.',
            );
        }
        (request as RequestWithDocument).file = {
            buffer: fileBuffer,
            size: fileBuffer.length,
            mimetype: mime,
        };
        next();
    },
);

export const submitDocumentController: RequestHandler = asyncHandler(
    async (request, response) => {
        const user = requireUser(request.authUser);
        const documentType = documentTypeForRole(user.role);
        const file = (request as RequestWithDocument).file;
        if (!file) {
            throw new AppError(400, 'DOCUMENT_REQUIRED', 'Choose a document to upload.');
        }
        const document = await storePrivateDocument(file);
        try {
            await submitVerificationDocument(user, documentType, document);
        } catch (error) {
            await removePrivateDocument(document.storageKey);
            throw error;
        }
        response.status(201).json({
            verification: {
                documentType,
                status: 'pending',
                message: 'Your document was submitted for review.',
            },
        });
    },
);

export const ownVerificationController: RequestHandler = asyncHandler(
    async (request, response) => {
        response.json({
            verification: await getOwnVerification(requireUser(request.authUser)),
        });
    },
);

export const listSubmissionsController: RequestHandler = asyncHandler(
    async (request, response) => {
        const statusQuery = z
            .enum(['pending', 'approved', 'rejected', 'resubmission_required'])
            .optional()
            .safeParse(request.query.status);
        if (!statusQuery.success) {
            throw new AppError(
                400,
                'VALIDATION_ERROR',
                'Unknown verification status filter.',
            );
        }
        response.json({
            submissions: await listVerificationSubmissions(statusQuery.data),
        });
    },
);

export const reviewSubmissionController: RequestHandler = asyncHandler(
    async (request, response) => {
        const id = z
            .string()
            .regex(/^[0-9a-fA-F]{24}$/)
            .safeParse(request.params.id);
        if (!id.success) {
            throw new AppError(400, 'VALIDATION_ERROR', 'Invalid submission identifier.');
        }
        const reviewer = requireUser(request.authUser);
        const input = parseBody(reviewSchema, request.body);
        await reviewVerificationSubmission(
            id.data,
            reviewer.id,
            input.status,
            input.reviewNote,
        );
        response.json({ message: 'Verification review saved.' });
    },
);

export const submissionDocumentController: RequestHandler = asyncHandler(
    async (request, response) => {
        const id = z
            .string()
            .regex(/^[0-9a-fA-F]{24}$/)
            .safeParse(request.params.id);
        if (!id.success) {
            throw new AppError(400, 'VALIDATION_ERROR', 'Invalid submission identifier.');
        }
        const { submission, storageKey, contentType } = await getSubmissionDocument(
            id.data,
        );
        if (submission.status !== 'pending') {
            throw new AppError(
                409,
                'DOCUMENT_REVIEW_CLOSED',
                'This document is no longer available for review.',
            );
        }
        const document = await readPrivateDocument(storageKey);
        response.set({
            'Content-Type': contentType,
            'Content-Disposition': `attachment; filename="verification-document.${contentType === 'application/pdf' ? 'pdf' : contentType === 'image/png' ? 'png' : 'jpg'}"`,
            'Cache-Control': 'private, no-store, max-age=0',
            Pragma: 'no-cache',
            'X-Content-Type-Options': 'nosniff',
        });
        response.send(document);
    },
);

export const submissionSummaryController: RequestHandler = asyncHandler(
    async (_request, response) => {
        const count = await VerificationSubmission.countDocuments({ status: 'pending' });
        response.json({ pendingCount: count });
    },
);

function requireUser(user: SafeUser | undefined): SafeUser {
    if (!user) {
        throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Please sign in to continue.');
    }
    return user;
}
