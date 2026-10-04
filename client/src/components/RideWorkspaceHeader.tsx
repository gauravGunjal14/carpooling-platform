import { LogOut } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import type { Role } from '../types/auth';

type Props = { role: Exclude<Role, 'Admin'> };

export function RideWorkspaceHeader({ role }: Props) {
    const { signOut } = useAuth();
    const navigate = useNavigate();
    const isDriver = role === 'Driver';

    async function handleSignOut() {
        try {
            await signOut();
        } catch {
            // The local session is cleared by the auth provider when the request fails.
        }
        navigate('/', { replace: true });
    }

    return (
        <header className='ride-workspace-header'>
            <Link
                className='brand'
                to='/'
                aria-label='Wayfare home'
            >
                <span className='brand-mark'>
                    <span />
                </span>
                <span>
                    wayfare<span className='brand-period'>.</span>
                </span>
            </Link>
            <nav
                className='ride-workspace-nav'
                aria-label='Account navigation'
            >
                <Link to={isDriver ? '/app/driver' : '/app/passenger'}>
                    {isDriver ? 'My rides' : 'Find rides'}
                </Link>
                {isDriver && <Link to='/app/driver/rides/new'>Offer a ride</Link>}
                <Link to={isDriver ? '/app/driver/profile' : '/app/passenger/profile'}>
                    Profile
                </Link>
            </nav>
            <button
                className='profile-signout'
                type='button'
                onClick={handleSignOut}
            >
                <LogOut size={14} /> <span>Sign out</span>
            </button>
        </header>
    );
}
