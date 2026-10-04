import { BadgeCheck, HeartHandshake, LockKeyhole, Sparkles } from 'lucide-react'
import { trustSignals } from '../data/site'

const icons = [BadgeCheck, Sparkles, HeartHandshake, LockKeyhole]
export function TrustStrip() { return <section className="trust-strip" aria-label="Our approach to trust"><div className="container trust-row">{trustSignals.map((item, i) => { const Icon = icons[i]; return <div className="trust-item" key={item.title}><span className="trust-icon"><Icon size={19}/></span><span><strong>{item.title}</strong><small>{item.detail}</small></span></div> })}</div></section> }
