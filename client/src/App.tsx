import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider } from './providers/AuthProvider';
import { useAuth } from './hooks/useAuth';
import { sessionToRolePath } from './lib/authContext';
import type { Role } from './types/auth';
import { LandingPage } from './pages/LandingPage';
import { AuthPage } from './pages/AuthPage';
import { ProfilePage } from './pages/ProfilePage';
import { AdminVerificationPage } from './pages/VerificationPage';
import './pages/ProfilePage.css';
import './pages/VerificationPage.css';

function RequireAuth() {
    const { user, isLoading } = useAuth();
    const location = useLocation();
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
    if (!user)
        return (
            <Navigate
                to='/login'
                replace
                state={{ from: `${location.pathname}${location.search}` }}
            />
        );
    return <Outlet />;
}

function RequireRole({ roles }: { roles: Role[] }) {
    const { user } = useAuth();
    if (!user)
        return (
            <Navigate
                to='/login'
                replace
            />
        );
    if (!roles.includes(user.role))
        return (
            <Navigate
                to={sessionToRolePath({ user })}
                replace
            />
        );
    return roles.includes('Admin') ? <AdminVerificationPage /> : <ProfilePage />;
}

function RoleStart() {
    const { user } = useAuth();
    return user ? (
        <Navigate
            to={sessionToRolePath({ user })}
            replace
        />
    ) : (
        <Navigate
            to='/login'
            replace
        />
    );
}

function AppRoutes() {
    return (
        <Routes>
            <Route
                path='/'
                element={<LandingPage />}
            />
            <Route
                path='/login'
                element={<AuthPage mode='login' />}
            />
            <Route
                path='/register'
                element={<AuthPage mode='register' />}
            />
            <Route element={<RequireAuth />}>
                <Route
                    path='/app'
                    element={<RoleStart />}
                />
                <Route
                    path='/app/passenger'
                    element={<RequireRole roles={['Passenger']} />}
                />
                <Route
                    path='/app/driver'
                    element={<RequireRole roles={['Driver']} />}
                />
                <Route
                    path='/app/admin'
                    element={<RequireRole roles={['Admin']} />}
                />
            </Route>
            <Route
                path='*'
                element={
                    <Navigate
                        to='/'
                        replace
                    />
                }
            />
        </Routes>
    );
}

export default function App() {
    return (
        <AuthProvider>
            <AppRoutes />
        </AuthProvider>
    );
}
