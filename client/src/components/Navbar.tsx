import { useState } from 'react'
import { ArrowUpRight, Menu, X } from 'lucide-react'
import { navigation } from '../data/site'

export function Navbar() {
  const [open, setOpen] = useState(false)
  return <header className="site-header"><nav className="navbar container" aria-label="Main navigation">
    <a className="brand" href="#top" aria-label="Wayfare home"><span className="brand-mark"><span /></span><span>wayfare<span className="brand-period">.</span></span></a>
    <div className="nav-links">{navigation.map(item => <a key={item.href} href={item.href}>{item.label}</a>)}</div>
    <div className="nav-actions"><a className="login-link" href="#get-started">Log in</a><a className="button button-small button-dark" href="#get-started">Get started <ArrowUpRight size={15} /></a></div>
    <button className="menu-toggle" type="button" aria-label={open ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
    {open && <div className="mobile-menu">{navigation.map(item => <a key={item.href} href={item.href} onClick={() => setOpen(false)}>{item.label}</a>)}<a href="#get-started" onClick={() => setOpen(false)}>Log in</a><a className="button button-dark" href="#get-started" onClick={() => setOpen(false)}>Get started <ArrowUpRight size={16} /></a></div>}
  </nav></header>
}
