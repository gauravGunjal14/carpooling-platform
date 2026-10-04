import { useState, type FormEvent } from 'react';
import {
    ArrowLeft,
    ArrowRight,
    Eye,
    EyeOff,
    LockKeyhole,
    ShieldCheck,
    UserRound,
} from 'lucide-react';
import {
    Link,
    Navigate,
    useLocation,
    useNavigate,
    useSearchParams,
} from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ApiError } from '../lib/api';
import { sessionToRolePath } from '../lib/authContext';
import type { Role, User } from '../types/auth';
import './AuthPage.css';

type Props = { mode: 'login' | 'register' };

function routeAfterAuth(user: User, from: unknown): string {
    if (typeof from === 'string' && from.startsWith('/app')) return from;
    return sessionToRolePath({ user });
}

export function AuthPage({ mode }: Props) {
    const { user, isLoading, signIn, signUp } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [role, setRole] = useState<'Passenger' | 'Driver'>(
        searchParams.get('role') === 'driver' ? 'Driver' : 'Passenger',
    );
    const [showPassword, setShowPassword] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const isRegister = mode === 'register';
    const from = (location.state as { from?: unknown } | null)?.from;

    if (isLoading)
        return (
            <main className='auth-page'>
                <div
                    className='auth-wait'
                    role='status'
                >
                    Checking your session…
                </div>
            </main>
        );
    if (user)
        return (
            <Navigate
                to={sessionToRolePath({ user })}
                replace
            />
        );

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError('');
        if (isRegister && password !== confirmPassword) {
            setError('Those passwords do not match.');
            return;
        }
        setSubmitting(true);
        try {
            const signedInUser = isRegister
                ? await signUp({ name, email, password, role })
                : await signIn(email, password);
            navigate(routeAfterAuth(signedInUser, from), { replace: true });
        } catch (cause) {
            setError(
                cause instanceof ApiError
                    ? cause.message
                    : 'We couldn’t complete that request. Please try again.',
            );
        } finally {
            setSubmitting(false);
        }
    }

    const displayRole = role as Role;
    return (
        <main className='auth-page'>
            <div className='auth-topbar'>
                <Link
                    className='brand auth-brand'
                    to='/'
                >
                    <span className='brand-mark'>
                        <span />
                    </span>
                    <span>
                        wayfare<span className='brand-period'>.</span>
                    </span>
                </Link>
                <Link
                    className='auth-back'
                    to='/'
                >
                    <ArrowLeft size={15} /> Back to home
                </Link>
            </div>
            <div className='auth-layout'>
                <section
                    className='auth-form-panel'
                    aria-labelledby='auth-title'
                >
                    <span className='eyebrow'>
                        {isRegister ? 'A BETTER WAY TO GET THERE' : 'WELCOME BACK'}
                    </span>
                    <h1 id='auth-title'>
                        {isRegister ? 'Find your way.' : 'Good to see you.'}
                    </h1>
                    <p className='auth-intro'>
                        {isRegister
                            ? 'Create an account to start finding rides and people that fit your journey.'
                            : 'Sign in to continue your journey with Wayfare.'}
                    </p>
                    <form
                        className='auth-form'
                        onSubmit={handleSubmit}
                    >
                        {isRegister && (
                            <label className='auth-field'>
                                <span>Your name</span>
                                <div className='auth-input-wrap'>
                                    <UserRound
                                        size={17}
                                        aria-hidden='true'
                                    />
                                    <input
                                        autoComplete='name'
                                        name='name'
                                        value={name}
                                        onChange={(event) => setName(event.target.value)}
                                        required
                                        minLength={2}
                                        maxLength={80}
                                        placeholder='How should we address you?'
                                    />
                                </div>
                            </label>
                        )}
                        <label className='auth-field'>
                            <span>Email address</span>
                            <div className='auth-input-wrap'>
                                <input
                                    type='email'
                                    autoComplete='email'
                                    name='email'
                                    value={email}
                                    onChange={(event) => setEmail(event.target.value)}
                                    required
                                    maxLength={254}
                                    placeholder='you@example.com'
                                />
                            </div>
                        </label>
                        <label className='auth-field'>
                            <span>Password</span>
                            <div className='auth-input-wrap'>
                                <LockKeyhole
                                    size={16}
                                    aria-hidden='true'
                                />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    autoComplete={
                                        isRegister ? 'new-password' : 'current-password'
                                    }
                                    name='password'
                                    value={password}
                                    onChange={(event) => setPassword(event.target.value)}
                                    required
                                    minLength={isRegister ? 12 : 1}
                                    maxLength={72}
                                    placeholder={
                                        isRegister
                                            ? 'At least 12 characters'
                                            : 'Enter your password'
                                    }
                                />
                                <button
                                    type='button'
                                    className='password-toggle'
                                    onClick={() => setShowPassword((value) => !value)}
                                    aria-label={
                                        showPassword ? 'Hide password' : 'Show password'
                                    }
                                >
                                    {showPassword ? (
                                        <EyeOff size={16} />
                                    ) : (
                                        <Eye size={16} />
                                    )}
                                </button>
                            </div>
                        </label>
                        {isRegister && (
                            <>
                                <label className='auth-field'>
                                    <span>Confirm password</span>
                                    <div className='auth-input-wrap'>
                                        <LockKeyhole
                                            size={16}
                                            aria-hidden='true'
                                        />
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            autoComplete='new-password'
                                            name='confirmPassword'
                                            value={confirmPassword}
                                            onChange={(event) =>
                                                setConfirmPassword(event.target.value)
                                            }
                                            required
                                            maxLength={72}
                                            placeholder='Enter it once more'
                                        />
                                    </div>
                                </label>
                                <label className='auth-field'>
                                    <span>I’m joining as</span>
                                    <div className='auth-input-wrap auth-select-wrap'>
                                        <select
                                            value={displayRole}
                                            onChange={(event) =>
                                                setRole(
                                                    event.target.value as
                                                        'Passenger' | 'Driver',
                                                )
                                            }
                                            aria-label='Choose Passenger or Driver role'
                                        >
                                            <option value='Passenger'>Passenger</option>
                                            <option value='Driver'>Driver</option>
                                        </select>
                                    </div>
                                    <small className='auth-field-note'>
                                        Admin accounts are provisioned separately.
                                    </small>
                                </label>
                            </>
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
                            className='button button-burgundy auth-submit'
                            type='submit'
                            disabled={submitting}
                        >
                            {submitting
                                ? 'Please wait…'
                                : isRegister
                                  ? 'Create account'
                                  : 'Sign in'}{' '}
                            <ArrowRight size={17} />
                        </button>
                    </form>
                    <p className='auth-switch'>
                        {isRegister ? 'Already have an account?' : 'New to Wayfare?'}{' '}
                        <Link to={isRegister ? '/login' : '/register'}>
                            {isRegister ? 'Sign in' : 'Create an account'}
                        </Link>
                    </p>
                    <p className='auth-privacy'>
                        <LockKeyhole size={13} /> Your account details stay private and
                        secure.
                    </p>
                </section>
                <aside
                    className='auth-aside'
                    aria-label='Wayfare account benefits'
                >
                    <div className='auth-aside-orbit orbit-first' />
                    <div className='auth-aside-orbit orbit-second' />
                    <div className='auth-aside-copy'>
                        <span>
                            <ShieldCheck size={17} /> PEOPLE FIRST, ALWAYS
                        </span>
                        <h2>
                            Good journeys
                            <br />
                            start with trust.
                        </h2>
                        <p>
                            Thoughtful matches. Useful trust signals. Your personal
                            details kept private.
                        </p>
                    </div>
                    <div className='auth-aside-bottom'>
                        <span className='aside-check'>✓</span>
                        <span>
                            <b>
                                {isRegister
                                    ? `${displayRole} account`
                                    : 'Your account, your way'}
                            </b>
                            <small>
                                {isRegister
                                    ? 'You can update your profile any time.'
                                    : 'Your rides and profile are ready when you are.'}
                            </small>
                        </span>
                    </div>
                </aside>
            </div>
            <p className='auth-legal'>
                By continuing, you agree to our{' '}
                <a href='mailto:hello@wayfare.example?subject=Terms%20of%20service'>
                    Terms
                </a>{' '}
                and{' '}
                <a href='mailto:hello@wayfare.example?subject=Privacy%20policy'>
                    Privacy Policy
                </a>
                .
            </p>
        </main>
    );
}
