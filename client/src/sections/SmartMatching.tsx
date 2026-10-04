import {
    ArrowRight,
    BadgeCheck,
    Check,
    Clock3,
    MapPin,
    Route,
    ShieldCheck,
    Sparkles,
} from 'lucide-react';
import { SectionHeading } from '../components/SectionHeading';

const factors = [
    { icon: MapPin, label: 'Location fit', note: 'Pickup is close to you' },
    { icon: Route, label: 'Route fit', note: 'Your destination is on the way' },
    { icon: Clock3, label: 'Time fit', note: 'Departure suits your day' },
    { icon: ShieldCheck, label: 'Trust fit', note: 'Verified, highly rated driver' },
];
export function SmartMatching() {
    return (
        <section
            className='section matching-section'
            id='matching'
        >
            <div className='container matching-layout'>
                <div className='matching-copy'>
                    <SectionHeading
                        eyebrow='More than a list of rides'
                        title='The right ride is a little more than a route.'
                        description='We look at the details that make a shared journey work—so the options you see feel more relevant from the start.'
                    />
                    <div className='matching-flow'>
                        {factors.map((f, i) => (
                            <div
                                className='flow-item'
                                key={f.label}
                            >
                                <span className='flow-icon'>
                                    <f.icon size={17} />
                                </span>
                                <span>
                                    <b>{f.label}</b>
                                    <small>{f.note}</small>
                                </span>
                                {i < 3 && <span className='flow-line' />}
                            </div>
                        ))}
                        <div className='flow-result'>
                            <Sparkles size={16} />
                            <span>
                                <b>A more thoughtful match</b>
                                <small>Ranked around your trip</small>
                            </span>
                        </div>
                    </div>
                    <p className='demo-note'>A preview of how matching will work.</p>
                </div>
                <div className='match-demo'>
                    <div className='demo-topline'>
                        <span>
                            <span className='live-dot' /> A GOOD FIT FOR YOUR TRIP
                        </span>
                        <span>DEMO</span>
                    </div>
                    <div className='demo-route'>
                        <div className='route-cities'>
                            <b>Mumbai</b>
                            <span>to</span>
                            <b>Pune</b>
                        </div>
                        <div className='route-line'>
                            <span />
                            <i />
                            <span />
                        </div>
                        <div className='route-meta'>
                            <span>Fri, 24 Oct</span>
                            <span>
                                10:00 AM <b>·</b> 3.5 hrs
                            </span>
                        </div>
                    </div>
                    <div className='match-score'>
                        <div>
                            <small>COMPATIBILITY</small>
                            <b>
                                94<span>%</span>
                            </b>
                            <small>strong match</small>
                        </div>
                        <div className='score-ring'>
                            <span>94</span>
                        </div>
                    </div>
                    <div className='ride-driver'>
                        <div className='driver-avatar'>A</div>
                        <div>
                            <b>Arjun’s ride</b>
                            <span>
                                <BadgeCheck size={13} /> Verified driver <i>·</i> ★ 4.9
                            </span>
                        </div>
                        <span className='seats-pill'>2 seats left</span>
                    </div>
                    <div className='match-checks'>
                        {[
                            'Pickup nearby',
                            'Route compatible',
                            'Departure fits',
                            'High trust score',
                        ].map((item) => (
                            <span key={item}>
                                <Check size={14} />
                                {item}
                            </span>
                        ))}
                    </div>
                    <a
                        className='demo-link'
                        href='#ride-search'
                    >
                        See how it works <ArrowRight size={15} />
                    </a>
                </div>
            </div>
        </section>
    );
}
