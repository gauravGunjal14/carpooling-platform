import { useEffect, useState, type FormEvent } from 'react';
import {
    BadgeCheck,
    Check,
    Clock3,
    Eye,
    FileCheck2,
    LogOut,
    RefreshCw,
    ShieldCheck,
    X,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import type { Role } from '../types/auth';

type Status =
    'not_submitted' | 'pending' | 'approved' | 'rejected' | 'resubmission_required';
type Verification = {
    role: Role;
    documentType: 'driver_license' | 'identity';
    status: Status;
    isVerified: boolean;
    submittedAt: string | null;
    reviewedAt: string | null;
    reviewNote: string | null;
};
type Submission = {
    id: string;
    documentType: 'driver_license' | 'identity';
    status: Exclude<Status, 'not_submitted'>;
    submittedAt: string;
    reviewedAt: string | null;
    reviewNote: string | null;
    applicant: { id: string; name: string; email: string; role: string } | null;
};

const statusLabels: Record<Status, string> = {
    not_submitted: 'Not submitted',
    pending: 'In review',
    approved: 'Verified',
    rejected: 'Not approved',
    resubmission_required: 'Action required',
};

export function VerificationPanel() {
    const { request, user } = useAuth();
    const [verification, setVerification] = useState<Verification | null>(null);
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    async function loadStatus() {
        setLoading(true);
        try {
            const result = await request<{ verification: Verification }>(
                '/api/verification/me',
            );
            setVerification(result.verification);
        } catch (cause) {
            setError(
                cause instanceof Error
                    ? cause.message
                    : 'Verification status could not be loaded.',
            );
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void loadStatus();
    }, [user?.id]);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!file) return;
        const form = event.currentTarget;
        setError('');
        setNotice('');
        setSaving(true);
        try {
            const body = new FormData();
            body.append('document', file);
            await request('/api/verification/documents', { method: 'POST', body });
            setNotice('Your document was submitted securely for review.');
            setFile(null);
            form.reset();
            await loadStatus();
        } catch (cause) {
            setError(
                cause instanceof Error
                    ? cause.message
                    : 'Your document could not be submitted.',
            );
        } finally {
            setSaving(false);
        }
    }

    const title =
        verification?.documentType === 'driver_license'
            ? 'Driving licence'
            : 'Identity document';
    const canSubmit =
        !loading &&
        (!verification ||
            ['not_submitted', 'rejected', 'resubmission_required'].includes(
                verification.status,
            ));

    return (
        <section
            className='verification-card'
            aria-labelledby='verification-title'
        >
            <div className='verification-heading'>
                <span className='verification-icon'>
                    <ShieldCheck size={18} />
                </span>
                <div>
                    <span className='eyebrow'>ACCOUNT SAFETY</span>
                    <h2 id='verification-title'>Identity verification</h2>
                </div>
                {verification?.isVerified && (
                    <span className='verified-badge'>
                        <BadgeCheck size={14} /> Verified
                    </span>
                )}
            </div>
            <p className='verification-copy'>
                {user?.role === 'Driver'
                    ? 'Submit a driving licence for a private admin review. Your document is never shown on public profiles.'
                    : 'Submit an identity document for a private admin review. We do not ask for or display identity numbers.'}
            </p>
            <div
                className={`verification-status verification-status-${verification?.status ?? 'pending'}`}
                role='status'
            >
                {verification?.status === 'approved' ? (
                    <BadgeCheck size={16} />
                ) : (
                    <Clock3 size={16} />
                )}
                <span>
                    <small>STATUS</small>
                    <strong>
                        {loading
                            ? 'Loading…'
                            : statusLabels[verification?.status ?? 'not_submitted']}
                    </strong>
                </span>
            </div>
            {canSubmit && (
                <form
                    className='verification-form'
                    onSubmit={handleSubmit}
                >
                    <label className='auth-field'>
                        <span>
                            {title} <small>(PDF, JPG, PNG · up to 5 MB)</small>
                        </span>
                        <input
                            className='verification-file'
                            type='file'
                            accept='.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png'
                            required
                            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                        />
                    </label>
                    {verification?.reviewNote && (
                        <p className='verification-hint'>
                            Reviewer note: {verification.reviewNote}
                        </p>
                    )}
                    {verification?.status === 'resubmission_required' &&
                        !verification.reviewNote && (
                            <p className='verification-hint'>
                                Please upload a clearer or corrected document to continue.
                            </p>
                        )}
                    {error && (
                        <p
                            className='auth-error'
                            role='alert'
                        >
                            {error}
                        </p>
                    )}
                    {notice && (
                        <p
                            className='profile-success'
                            role='status'
                        >
                            {notice}
                        </p>
                    )}
                    <button
                        className='button button-burgundy verification-submit'
                        type='submit'
                        disabled={saving || !file}
                    >
                        <FileCheck2 size={15} />{' '}
                        {saving ? 'Submitting…' : 'Submit for review'}
                    </button>
                </form>
            )}
            {!canSubmit && error && (
                <p
                    className='auth-error'
                    role='alert'
                >
                    {error}
                </p>
            )}
            {verification?.status === 'rejected' && !verification.reviewNote && (
                <p className='verification-hint'>
                    This submission was not approved. You can submit a new document.
                </p>
            )}
            <p className='verification-privacy'>
                Only authorized verification reviewers can access the uploaded document.
            </p>
        </section>
    );
}

export function AdminVerificationPage() {
    const { request, requestBlob, signOut } = useAuth();
    const navigate = useNavigate();
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [status, setStatus] = useState('pending');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [workingId, setWorkingId] = useState('');
    const [notes, setNotes] = useState<Record<string, string>>({});

    async function handleSignOut() {
        try {
            await signOut();
        } catch {
            // The local session is still cleared if the API is unreachable.
        }
        navigate('/', { replace: true });
    }

    async function loadQueue() {
        setLoading(true);
        setError('');
        try {
            const query = status ? `?status=${encodeURIComponent(status)}` : '';
            const result = await request<{ submissions: Submission[] }>(
                `/api/verification/admin/submissions${query}`,
            );
            setSubmissions(result.submissions);
        } catch (cause) {
            setError(
                cause instanceof Error
                    ? cause.message
                    : 'The verification queue could not be loaded.',
            );
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void loadQueue();
    }, [status]);

    async function openDocument(id: string) {
        setWorkingId(id);
        setError('');
        try {
            const blob = await requestBlob(
                `/api/verification/admin/submissions/${id}/document`,
            );
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `verification-review-document.${blob.type === 'application/pdf' ? 'pdf' : blob.type === 'image/png' ? 'png' : 'jpg'}`;
            link.click();
            window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
        } catch (cause) {
            setError(
                cause instanceof Error
                    ? cause.message
                    : 'The document could not be opened.',
            );
        } finally {
            setWorkingId('');
        }
    }

    async function review(
        id: string,
        decision: 'approved' | 'rejected' | 'resubmission_required',
    ) {
        setWorkingId(id);
        setError('');
        try {
            await request(`/api/verification/admin/submissions/${id}`, {
                method: 'PATCH',
                body: JSON.stringify({ status: decision, reviewNote: notes[id] ?? '' }),
            });
            await loadQueue();
        } catch (cause) {
            setError(
                cause instanceof Error ? cause.message : 'The review could not be saved.',
            );
        } finally {
            setWorkingId('');
        }
    }

    return (
        <main className='profile-page verification-admin-page'>
            <header className='profile-topbar'>
                <a
                    className='brand'
                    href='/'
                    aria-label='Wayfare home'
                >
                    <span className='brand-mark'>
                        <span />
                    </span>
                    <span>
                        wayfare<span className='brand-period'>.</span>
                    </span>
                </a>
                <div className='verification-admin-actions'>
                    <span className='admin-label'>
                        <ShieldCheck size={15} /> Verification review
                    </span>
                    <button
                        className='profile-signout'
                        type='button'
                        onClick={handleSignOut}
                    >
                        <LogOut size={14} /> Sign out
                    </button>
                </div>
            </header>
            <div className='verification-admin-wrap'>
                <span className='eyebrow'>WAYFARE · ADMIN</span>
                <h1>Verification queue</h1>
                <p className='verification-admin-intro'>
                    Review submitted documents through this restricted workspace.
                    Applicants cannot see other submissions or reviewer controls.
                </p>
                <label className='verification-filter'>
                    <span>Submission status</span>
                    <select
                        value={status}
                        onChange={(event) => setStatus(event.target.value)}
                    >
                        <option value='pending'>Pending</option>
                        <option value='approved'>Approved</option>
                        <option value='rejected'>Rejected</option>
                        <option value='resubmission_required'>
                            Resubmission required
                        </option>
                        <option value=''>All submissions</option>
                    </select>
                </label>
                {error && (
                    <p
                        className='auth-error'
                        role='alert'
                    >
                        {error}
                    </p>
                )}
                {loading ? (
                    <p
                        className='verification-empty'
                        role='status'
                    >
                        Loading submissions…
                    </p>
                ) : submissions.length === 0 ? (
                    <p className='verification-empty'>No submissions in this view.</p>
                ) : (
                    <div className='verification-queue'>
                        {submissions.map((submission) => (
                            <article
                                className='verification-submission'
                                key={submission.id}
                            >
                                <div className='verification-submission-head'>
                                    <div>
                                        <span className='eyebrow'>
                                            {submission.documentType === 'driver_license'
                                                ? 'DRIVING LICENCE'
                                                : 'IDENTITY DOCUMENT'}
                                        </span>
                                        <h2>
                                            {submission.applicant?.name ??
                                                'Account unavailable'}
                                        </h2>
                                        <p>
                                            {submission.applicant?.email} ·{' '}
                                            {submission.applicant?.role}
                                        </p>
                                    </div>
                                    <span
                                        className={`verification-chip verification-chip-${submission.status}`}
                                    >
                                        {statusLabels[submission.status]}
                                    </span>
                                </div>
                                <div className='verification-submission-meta'>
                                    <span>
                                        Submitted{' '}
                                        {new Date(
                                            submission.submittedAt,
                                        ).toLocaleString()}
                                    </span>
                                    {submission.reviewNote && (
                                        <p>Previous note: {submission.reviewNote}</p>
                                    )}
                                </div>
                                <button
                                    className='verification-document-button'
                                    type='button'
                                    onClick={() => void openDocument(submission.id)}
                                    disabled={
                                        workingId === submission.id ||
                                        submission.status !== 'pending'
                                    }
                                >
                                    <Eye size={15} />{' '}
                                    {workingId === submission.id
                                        ? 'Opening…'
                                        : 'View private document'}
                                </button>
                                {submission.status === 'pending' && (
                                    <>
                                        <label className='auth-field verification-review-note'>
                                            <span>
                                                Review note{' '}
                                                <small>
                                                    (required for rejection or
                                                    resubmission)
                                                </small>
                                            </span>
                                            <textarea
                                                maxLength={500}
                                                value={notes[submission.id] ?? ''}
                                                onChange={(event) =>
                                                    setNotes((current) => ({
                                                        ...current,
                                                        [submission.id]:
                                                            event.target.value,
                                                    }))
                                                }
                                            />
                                        </label>
                                        <div className='verification-review-actions'>
                                            <button
                                                className='verification-action verification-action-approve'
                                                type='button'
                                                onClick={() =>
                                                    void review(submission.id, 'approved')
                                                }
                                                disabled={workingId === submission.id}
                                            >
                                                <Check size={14} /> Approve
                                            </button>
                                            <button
                                                className='verification-action'
                                                type='button'
                                                onClick={() =>
                                                    void review(
                                                        submission.id,
                                                        'resubmission_required',
                                                    )
                                                }
                                                disabled={
                                                    workingId === submission.id ||
                                                    !notes[submission.id]?.trim()
                                                }
                                            >
                                                <RefreshCw size={14} /> Request
                                                resubmission
                                            </button>
                                            <button
                                                className='verification-action verification-action-reject'
                                                type='button'
                                                onClick={() =>
                                                    void review(submission.id, 'rejected')
                                                }
                                                disabled={
                                                    workingId === submission.id ||
                                                    !notes[submission.id]?.trim()
                                                }
                                            >
                                                <X size={14} /> Reject
                                            </button>
                                        </div>
                                    </>
                                )}
                            </article>
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
}
