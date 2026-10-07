import { Schema, model, type Types } from 'mongoose';

export const verificationStatuses = [
    'pending',
    'approved',
    'rejected',
    'resubmission_required',
] as const;

export type VerificationStatus = (typeof verificationStatuses)[number];
export type VerificationDocumentType = 'driver_license' | 'identity';

export interface VerificationSubmissionFields {
    userId: Types.ObjectId;
    documentType: VerificationDocumentType;
    status: VerificationStatus;
    womenOnlyEligible: boolean;
    storageKey: string;
    contentType: 'application/pdf' | 'image/jpeg' | 'image/png';
    sizeBytes: number;
    sha256: string;
    reviewedBy?: Types.ObjectId;
    reviewedAt?: Date;
    reviewNote?: string;
    createdAt: Date;
    updatedAt: Date;
}

const verificationSubmissionSchema = new Schema<VerificationSubmissionFields>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        documentType: {
            type: String,
            enum: ['driver_license', 'identity'],
            required: true,
        },
        status: {
            type: String,
            enum: verificationStatuses,
            required: true,
            default: 'pending',
        },
        womenOnlyEligible: {
            type: Boolean,
            default: false,
            required: true,
        },
        storageKey: { type: String, required: true, select: false },
        contentType: {
            type: String,
            enum: ['application/pdf', 'image/jpeg', 'image/png'],
            required: true,
            select: false,
        },
        sizeBytes: { type: Number, required: true, select: false },
        sha256: { type: String, required: true, select: false },
        reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', select: false },
        reviewedAt: Date,
        reviewNote: { type: String, maxlength: 500, select: false },
    },
    { timestamps: true, versionKey: false },
);

verificationSubmissionSchema.index({ userId: 1, documentType: 1 }, { unique: true });
verificationSubmissionSchema.index({ status: 1, createdAt: 1 });

export const VerificationSubmission = model<VerificationSubmissionFields>(
    'VerificationSubmission',
    verificationSubmissionSchema,
);
