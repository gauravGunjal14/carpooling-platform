import {
    ArrowRight,
    BadgeCheck,
    Heart,
    ShieldCheck,
    Sparkles,
    Users,
} from 'lucide-react';
import { SectionHeading } from '../components/SectionHeading';

export function WomenOnlySection() {
    return (
        <section
            className='section women-section'
            id='women-only'
        >
            <div className='container women-layout'>
                <div className='women-visual'>
                    <div className='women-orbit orbit-a' />
                    <div className='women-orbit orbit-b' />
                    <div className='women-center'>
                        <Heart size={27} />
                        <span>
                            A CHOICE
                            <br />
                            FOR YOUR RIDE
                        </span>
                    </div>
                    <div className='women-badge badge-top'>
                        <ShieldCheck size={15} /> A considered option
                    </div>
                    <div className='women-badge badge-bottom'>
                        <Users size={15} /> Travel on your terms
                    </div>
                    <span className='women-deco deco-one'>✳</span>
                    <span className='women-deco deco-two'>✳</span>
                </div>
                <div className='women-copy'>
                    <SectionHeading
                        eyebrow='Room for choice'
                        title='A ride option that puts comfort first.'
                        description='Drivers can choose to offer women-only rides. Eligible, verified female passengers can discover and book them, with eligibility confirmed by the platform.'
                    />
                    <div className='women-features'>
                        <span>
                            <BadgeCheck size={16} /> Verified profiles
                        </span>
                        <span>
                            <Heart size={16} /> Respectful by design
                        </span>
                    </div>
                    <a
                        className='text-link'
                        href='#get-started'
                    >
                        Learn about women-only rides <ArrowRight size={16} />
                    </a>
                    <p className='demo-note'>
                        <Sparkles size={14} /> A platform feature preview
                    </p>
                </div>
            </div>
        </section>
    );
}
