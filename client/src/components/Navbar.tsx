import { useState } from 'react';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { navigation } from '../data/site';

export function Navbar() {
    const [open, setOpen] = useState(false);
    return (
        <header className='site-header'>
            <nav
                className='navbar container'
                aria-label='Main navigation'
            >
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
                <div className='nav-links'>
                    {navigation.map((item) => (
                        <Link
                            key={item.href}
                            to={`/${item.href}`}
                        >
                            {item.label}
                        </Link>
                    ))}
                </div>
                <div className='nav-actions'>
                    <Link
                        className='login-link'
                        to='/login'
                    >
                        Log in
                    </Link>
                    <Link
                        className='button button-small button-dark'
                        to='/register'
                    >
                        Get started <ArrowUpRight size={15} />
                    </Link>
                </div>
                <button
                    className='menu-toggle'
                    type='button'
                    aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
                    aria-expanded={open}
                    onClick={() => setOpen(!open)}
                >
                    {open ? <X /> : <Menu />}
                </button>
                {open && (
                    <div className='mobile-menu'>
                        {navigation.map((item) => (
                            <Link
                                key={item.href}
                                to={`/${item.href}`}
                                onClick={() => setOpen(false)}
                            >
                                {item.label}
                            </Link>
                        ))}
                        <Link
                            to='/login'
                            onClick={() => setOpen(false)}
                        >
                            Log in
                        </Link>
                        <Link
                            className='button button-dark'
                            to='/register'
                            onClick={() => setOpen(false)}
                        >
                            Get started <ArrowUpRight size={16} />
                        </Link>
                    </div>
                )}
            </nav>
        </header>
    );
}
