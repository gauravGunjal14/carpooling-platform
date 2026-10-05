import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { AuthProvider } from './providers/AuthProvider';
import { SocketProvider } from './providers/SocketProvider';
import { useAuth } from './hooks/useAuth';
import { sessionToRolePath } from './lib/authContext';
import type { Role } from './types/auth';
import { LandingPage } from './pages/LandingPage';
import { AuthPage } from './pages/AuthPage';
import { ProfilePage } from './pages/ProfilePage';
import { AdminVerificationPage } from './pages/VerificationPage';
import { DriverRidesPage } from './pages/DriverRidesPage';
import { PassengerBookingsPage } from './pages/PassengerBookingsPage';
import { RideFormPage } from './pages/RideFormPage';
import { RideDetailsPage } from './pages/RideDetailsPage';
import { RideSearchPage } from './pages/RideSearchPage';
import './pages/ProfilePage.css';
import './pages/VerificationPage.css';
import './pages/RidePages.css';

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

function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
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
    return children;
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
                    element={
                        <RequireRole roles={['Passenger']}>
                            <RideSearchPage />
                        </RequireRole>
                    }
                />
                <Route
                    path='/app/passenger/bookings'
                    element={
                        <RequireRole roles={['Passenger']}>
                            <PassengerBookingsPage />
                        </RequireRole>
                    }
                />
                <Route
                    path='/app/passenger/profile'
                    element={
                        <RequireRole roles={['Passenger']}>
                            <ProfilePage />
                        </RequireRole>
                    }
                />
                <Route
                    path='/app/passenger/rides/:id'
                    element={
                        <RequireRole roles={['Passenger']}>
                            <RideDetailsPage />
                        </RequireRole>
                    }
                />
                <Route
                    path='/app/driver'
                    element={
                        <RequireRole roles={['Driver']}>
                            <DriverRidesPage />
                        </RequireRole>
                    }
                />
                <Route
                    path='/app/driver/profile'
                    element={
                        <RequireRole roles={['Driver']}>
                            <ProfilePage />
                        </RequireRole>
                    }
                />
                <Route
                    path='/app/driver/rides/new'
                    element={
                        <RequireRole roles={['Driver']}>
                            <RideFormPage />
                        </RequireRole>
                    }
                />
                <Route
                    path='/app/driver/rides/:id/edit'
                    element={
                        <RequireRole roles={['Driver']}>
                            <RideFormPage />
                        </RequireRole>
                    }
                />
                <Route
                    path='/app/admin'
                    element={
                        <RequireRole roles={['Admin']}>
                            <AdminVerificationPage />
                        </RequireRole>
                    }
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
            <SocketProvider>
                <AppRoutes />
            </SocketProvider>
        </AuthProvider>
    );
}
