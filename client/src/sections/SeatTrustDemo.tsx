import { BadgeCheck, Check, LockKeyhole, ShieldCheck, Star } from 'lucide-react';
import { useState } from 'react';
import { SectionHeading } from '../components/SectionHeading';

export function SeatTrustDemo() {
    const [selected, setSelected] = useState(2);
    return (
        <section
            className='section seat-section'
            id='trust'
        >
            <div className='container'>
                <SectionHeading
                    centered
                    eyebrow='Privacy is part of trust'
                    title='See the signal. Keep the person private.'
                    description='Before booking, you can understand the trust context around an occupied seat—without seeing who’s in it.'
                />
                <div className='seat-demo'>
                    <div className='seat-demo-left'>
                        <div className='seat-demo-head'>
                            <div>
                                <span className='eyebrow'>SEAT SELECTOR</span>
                                <h3>Choose your place</h3>
                            </div>
                        </div>
                        <div className='seat-layout'>
                            <div className='car-outline'>
                                <div className='car-front'>
                                    <span>FRONT</span>
                                    <div
                                        className='seat steering'
                                        aria-hidden='true'
                                    >
                                        ◖
                                    </div>
                                    <button
                                        className={`seat ${selected === 1 ? 'chosen' : ''}`}
                                        onClick={() =>
                                            setSelected(selected === 1 ? 0 : 1)
                                        }
                                        aria-label='Seat 1, available'
                                    >
                                        1
                                    </button>
                                </div>
                                <div className='car-back'>
                                    <button
                                        className={`seat ${selected === 2 ? 'chosen' : ''}`}
                                        onClick={() =>
                                            setSelected(selected === 2 ? 0 : 2)
                                        }
                                        aria-label='Seat 2, occupied'
                                        aria-pressed={selected === 2}
                                    >
                                        <span className='occupant-mark'>●</span>2
                                    </button>
                                    <button
                                        className={`seat ${selected === 3 ? 'chosen' : ''}`}
                                        onClick={() =>
                                            setSelected(selected === 3 ? 0 : 3)
                                        }
                                        aria-label='Seat 3, available'
                                        aria-pressed={selected === 3}
                                    >
                                        3
                                    </button>
                                    <button
                                        className={`seat ${selected === 4 ? 'chosen' : ''}`}
                                        onClick={() =>
                                            setSelected(selected === 4 ? 0 : 4)
                                        }
                                        aria-label='Seat 4, occupied'
                                        aria-pressed={selected === 4}
                                    >
                                        <span className='occupant-mark'>●</span>4
                                    </button>
                                </div>
                            </div>
                            <div className='seat-legend'>
                                <span>
                                    <i className='legend-available' /> Available
                                </span>
                                <span>
                                    <i className='legend-occupied' /> Occupied
                                </span>
                                <span>
                                    <i className='legend-selected' /> Selected
                                </span>
                            </div>
                        </div>
                        <p className='seat-hint'>
                            <span>i</span> Select an occupied seat to preview its
                            anonymous trust summary.
                        </p>
                    </div>
                    <div className='seat-demo-right'>
                        <span className='eyebrow'>
                            {selected === 2 || selected === 4
                                ? 'OCCUPIED SEAT · ANONYMOUS'
                                : 'SEAT STATUS'}
                        </span>
                        {selected === 2 || selected === 4 ? (
                            <article className='anonymous-card'>
                                <div className='anon-top'>
                                    <div className='anon-avatar'>
                                        <ShieldCheck size={22} />
                                    </div>
                                    <span>
                                        <b>Verified traveller</b>
                                        <small>Identity stays private</small>
                                    </span>
                                    <LockKeyhole
                                        size={16}
                                        className='anon-lock'
                                    />
                                </div>
                                <div className='anon-score'>
                                    <div>
                                        <small>TRUST SCORE</small>
                                        <strong>
                                            {selected === 2 ? '91' : '88'}
                                            <span> / 100</span>
                                        </strong>
                                    </div>
                                    <div className='anon-meter'>
                                        <i
                                            style={{
                                                width: selected === 2 ? '91%' : '88%',
                                            }}
                                        />
                                    </div>
                                </div>
                                <div className='anon-stats'>
                                    <span>
                                        <BadgeCheck size={15} /> Verified
                                    </span>
                                    <span>
                                        <Check size={15} /> 12 completed rides
                                    </span>
                                    <span>
                                        <Star
                                            size={14}
                                            fill='currentColor'
                                        />{' '}
                                        4.8 rating
                                    </span>
                                </div>
                            </article>
                        ) : (
                            <div className='empty-seat-card'>
                                <span className='empty-seat-icon'>
                                    <Check size={20} />
                                </span>
                                <h3>
                                    {selected === 1 || selected === 3
                                        ? 'Available seat'
                                        : 'Choose a seat'}
                                </h3>
                                <p>
                                    {selected === 1 || selected === 3
                                        ? 'This seat is open for your booking request.'
                                        : 'Pick any seat to see its status.'}
                                </p>
                            </div>
                        )}
                        <p className='privacy-promise'>
                            <LockKeyhole size={14} /> No names, contact details, or
                            personal identity are shown.
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
}
