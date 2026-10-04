import type { Types } from 'mongoose';
import { User } from '../models/User.js';
import {
    VerificationSubmission,
    type VerificationDocumentType,
    type VerificationStatus,
} from '../models/VerificationSubmission.js';
import type { SafeUser } from '../types/auth.js';
import { AppError } from '../utils/appError.js';
import { removePrivateDocument, type StoredDocument } from './privateDocumentStorage.js';

export async function submitVerificationDocument(
    user: SafeUser,
    documentType: VerificationDocumentType,
    document: StoredDocument,
) {
    const existing = await VerificationSubmission.findOne({
        userId: user.id,
        documentType,
    }).select('+storageKey +contentType +sizeBytes +sha256');

    if (existing && !['rejected', 'resubmission_required'].includes(existing.status)) {
        await removePrivateDocument(document.storageKey);
        throw new AppError(
            409,
            'SUBMISSION_NOT_REOPENED',
            existing.status === 'approved'
                ? 'This verification is already approved.'
                : 'A document is already being reviewed.',
        );
    }

    if (!existing) {
        try {
            await VerificationSubmission.create({
                userId: user.id,
                documentType,
                status: 'pending',
                ...document,
            });
        } catch (error) {
            await removePrivateDocument(document.storageKey);
            if (isDuplicateKeyError(error)) {
                throw new AppError(
                    409,
                    'SUBMISSION_IN_PROGRESS',
                    'A submission already exists. Refresh your status and try again.',
                );
            }
            throw error;
        }
        return;
    }

    const oldStorageKey = existing.storageKey;
    const updated = await VerificationSubmission.findOneAndUpdate(
        {
            _id: existing.id,
            status: { $in: ['rejected', 'resubmission_required'] },
        },
        {
            $set: { status: 'pending', womenOnlyEligible: false, ...document },
            $unset: { reviewedBy: 1, reviewedAt: 1, reviewNote: 1 },
        },
        { new: true, runValidators: true },
    );
    if (!updated) {
        await removePrivateDocument(document.storageKey);
        throw new AppError(
            409,
            'SUBMISSION_NOT_REOPENED',
            'This submission has already changed. Refresh your status and try again.',
        );
    }
    await removePrivateDocument(oldStorageKey);
}

export async function getOwnVerification(user: SafeUser) {
    const documentType = documentTypeForRole(user.role);
    const submission = await VerificationSubmission.findOne({
        userId: user.id,
        documentType,
    }).select('documentType status createdAt reviewedAt +reviewNote +womenOnlyEligible');

    return {
        role: user.role,
        documentType,
        status: submission?.status ?? 'not_submitted',
        isVerified: submission?.status === 'approved',
        submittedAt: submission?.createdAt ?? null,
        reviewedAt: submission?.reviewedAt ?? null,
        reviewNote: submission?.reviewNote ?? null,
        womenOnlyEligible:
            submission?.status === 'approved' && submission.womenOnlyEligible === true,
    };
}

export async function listVerificationSubmissions(status?: VerificationStatus) {
    const records = await VerificationSubmission.find(status ? { status } : {})
        .sort({ createdAt: -1 })
        .limit(100)
        .select(
            'userId documentType status reviewedAt createdAt +reviewNote +womenOnlyEligible',
        )
        .populate({ path: 'userId', select: 'name email role', model: User });

    return records.map((record) => {
        const account = record.userId as unknown as {
            _id: Types.ObjectId;
            name: string;
            email: string;
            role: string;
        } | null;
        return {
            id: record.id,
            documentType: record.documentType,
            status: record.status,
            womenOnlyEligible: record.womenOnlyEligible,
            submittedAt: record.createdAt,
            reviewedAt: record.reviewedAt ?? null,
            reviewNote: record.reviewNote ?? null,
            applicant: account
                ? {
                      id: account._id.toString(),
                      name: account.name,
                      email: account.email,
                      role: account.role,
                  }
                : null,
        };
    });
}

export async function getSubmissionDocument(id: string) {
    const submission = await VerificationSubmission.findById(id).select(
        '+storageKey +contentType',
    );
    if (!submission) {
        throw new AppError(
            404,
            'SUBMISSION_NOT_FOUND',
            'Verification submission not found.',
        );
    }
    return {
        submission,
        storageKey: submission.storageKey,
        contentType: submission.contentType,
    };
}

export async function reviewVerificationSubmission(
    id: string,
    reviewerId: string,
    status: Exclude<VerificationStatus, 'pending'>,
    reviewNote?: string,
    womenOnlyEligible = false,
): Promise<void> {
    const submission = await VerificationSubmission.findOneAndUpdate(
        { _id: id, status: 'pending' },
        {
            $set: {
                status,
                reviewedBy: reviewerId,
                reviewedAt: new Date(),
                reviewNote: reviewNote ?? '',
                womenOnlyEligible: status === 'approved' && womenOnlyEligible,
            },
        },
        { new: true, runValidators: true },
    );
    if (!submission) {
        const exists = await VerificationSubmission.exists({ _id: id });
        throw new AppError(
            exists ? 409 : 404,
            exists ? 'SUBMISSION_ALREADY_REVIEWED' : 'SUBMISSION_NOT_FOUND',
            exists
                ? 'This submission has already been reviewed.'
                : 'Verification submission not found.',
        );
    }
}

export function documentTypeForRole(role: SafeUser['role']): VerificationDocumentType {
    if (role === 'Driver') return 'driver_license';
    if (role === 'Passenger') return 'identity';
    throw new AppError(
        403,
        'ROLE_NOT_ELIGIBLE',
        'This account cannot submit identity verification.',
    );
}

function isDuplicateKeyError(error: unknown): boolean {
    return (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 11000
    );
}
