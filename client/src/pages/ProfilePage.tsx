import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, BadgeCheck, LogOut, Save, UserRound } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import type { User } from '../types/auth';
import { VerificationPanel } from './VerificationPage';

export function ProfilePage() {
    const { user, request, updateName, signOut } = useAuth();
    const navigate = useNavigate();
    const [profile, setProfile] = useState<User | null>(user);
    const [name, setName] = useState(user?.name ?? '');
    const [notice, setNotice] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let active = true;
        void request<{ user: User }>('/api/auth/me')
            .then((result) => {
                if (!active) return;
                setProfile(result.user);
                setName(result.user.name);
            })
            .catch(() => {
                if (active)
                    setError('We could not load your profile. Please sign in again.');
            });
        return () => {
            active = false;
        };
    }, [request]);

    async function handleSave(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setNotice('');
        setError('');
        setSaving(true);
        try {
            await updateName(name.trim());
            setProfile((current) =>
                current ? { ...current, name: name.trim() } : current,
            );
            setNotice('Your profile has been updated.');
        } catch (cause) {
            setError(
                cause instanceof Error
                    ? cause.message
                    : 'Your profile could not be updated.',
            );
        } finally {
            setSaving(false);
        }
    }

    async function handleSignOut() {
        try {
            await signOut();
        } catch {
            /* Clear the local session even when the API is unreachable. */
        }
        navigate('/', { replace: true });
    }

    return (
        <main className='profile-page'>
            <header className='profile-topbar'>
                <Link
                    className='brand'
                    to='/'
                >
                    <span className='brand-mark'>
                        <span />
                    </span>
                    <span>
                        wayfare<span className='brand-period'>.</span>
                    </span>
                </Link>
                <button
                    className='profile-signout'
                    type='button'
                    onClick={handleSignOut}
                >
                    <LogOut size={15} /> Sign out
                </button>
            </header>
            <div className='profile-wrap'>
                <Link
                    className='profile-back'
                    to='/'
                >
                    <ArrowLeft size={14} /> Back to Wayfare
                </Link>
                <section
                    className='profile-panel'
                    aria-labelledby='profile-title'
                >
                    <div className='profile-panel-heading'>
                        <span className='profile-icon'>
                            <UserRound size={20} />
                        </span>
                        <div>
                            <span className='eyebrow'>ACCOUNT FOUNDATION</span>
                            <h1 id='profile-title'>Your profile</h1>
                        </div>
                    </div>
                    <p className='profile-intro'>
                        Your account details are private and can be updated here.
                    </p>
                    <div className='profile-role'>
                        <BadgeCheck size={17} />
                        <span>
                            <small>ACCOUNT TYPE</small>
                            <strong>{profile?.role ?? user?.role}</strong>
                        </span>
                    </div>
                    <form
                        className='profile-form'
                        onSubmit={handleSave}
                    >
                        <label className='auth-field'>
                            <span>Name</span>
                            <div className='auth-input-wrap'>
                                <input
                                    autoComplete='name'
                                    name='name'
                                    value={name}
                                    onChange={(event) => setName(event.target.value)}
                                    required
                                    minLength={2}
                                    maxLength={80}
                                />
                            </div>
                        </label>
                        <label className='auth-field'>
                            <span>Email address</span>
                            <div className='auth-input-wrap'>
                                <input
                                    type='email'
                                    value={profile?.email ?? user?.email ?? ''}
                                    readOnly
                                    aria-readonly='true'
                                />
                            </div>
                            <small className='auth-field-note'>
                                Email changes aren’t available in this phase.
                            </small>
                        </label>
                        {notice && (
                            <p
                                className='profile-success'
                                role='status'
                            >
                                {notice}
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
                        <button
                            className='button button-burgundy profile-save'
                            type='submit'
                            disabled={saving}
                        >
                            <Save size={15} />
                            {saving ? 'Saving…' : 'Save profile'}
                        </button>
                    </form>
                    <VerificationPanel />
                    <div className='profile-phase-note'>
                        <span>Phase 3</span> Verification status is managed privately and
                        reviewed by an authorized administrator.
                    </div>
                </section>
            </div>
        </main>
    );
}
