import {
    ArrowDown,
    ArrowRight,
    CalendarDays,
    ChevronDown,
    LocateFixed,
    MapPin,
    MoveRight,
    Users,
} from 'lucide-react';

export function Hero() {
    return (
        <section
            className='hero'
            id='top'
        >
            <div className='hero-grid container'>
                <div className='hero-copy'>
                    <h1>
                        Good journeys
                        <br />
                        are shared.
                    </h1>
                    <p className='hero-description'>
                        Find a ride that fits your route, your schedule, and your
                        standards. Travel with people you can feel good about meeting.
                    </p>
                    <div className='hero-ctas'>
                        <a
                            className='button button-dark'
                            href='/register?role=passenger'
                        >
                            Find a ride <ArrowRight size={17} />
                        </a>
                        <a
                            className='text-link'
                            href='/register?role=driver'
                        >
                            I’m driving <MoveRight size={17} />
                        </a>
                    </div>
                    <div className='hero-proof'>
                        <div
                            className='avatar-stack'
                            aria-hidden='true'
                        >
                            <i>J</i>
                            <i>M</i>
                            <i>A</i>
                            <i>+</i>
                        </div>
                        <span>Better together, from the first mile.</span>
                    </div>
                </div>
                <div
                    className='hero-visual'
                    aria-label='Illustrated route map with ride search form'
                >
                    <div className='map-canvas'>
                        <div className='map-label label-city'>MUMBAI</div>
                        <div className='map-label label-water'>WESTERN GHATS</div>
                        <div className='map-road road-one' />
                        <div className='map-road road-two' />
                        <div className='map-road road-three' />
                        <div className='map-road road-four' />
                        <div className='map-road road-five' />
                        <div className='map-route'>
                            <span className='route-start' />
                            <span className='route-end'>
                                <MapPin
                                    size={20}
                                    fill='currentColor'
                                />
                            </span>
                            <svg
                                viewBox='0 0 420 260'
                                preserveAspectRatio='none'
                                aria-hidden='true'
                            >
                                <path d='M26 222 C85 205 80 155 160 163 S245 128 250 94 S326 75 387 27' />
                            </svg>
                        </div>
                        <div className='map-note'>
                            <span className='note-dot' /> Your route, thoughtfully matched
                        </div>
                        <div className='map-distance'>~ 150 km</div>
                    </div>
                    <form
                        className='search-card'
                        id='ride-search'
                        onSubmit={(e) => e.preventDefault()}
                    >
                        <div className='search-card-heading'>
                            <div>
                                <span className='eyebrow'>Start somewhere</span>
                                <h2>Where to next?</h2>
                            </div>
                            <span className='search-spark'>✳</span>
                        </div>
                        <label className='search-field'>
                            <span className='field-icon pickup'>
                                <MapPin size={17} />
                            </span>
                            <span className='field-content'>
                                <small>Leaving from</small>
                                <input
                                    aria-label='Leaving from'
                                    defaultValue='Mumbai, Maharashtra'
                                />
                            </span>
                            <LocateFixed
                                size={16}
                                className='field-trailing'
                                aria-hidden='true'
                            />
                        </label>
                        <label className='search-field'>
                            <span className='field-icon destination'>
                                <MapPin size={17} />
                            </span>
                            <span className='field-content'>
                                <small>Going to</small>
                                <input
                                    aria-label='Going to'
                                    placeholder='Pune, Maharashtra'
                                />
                            </span>
                        </label>
                        <div className='search-options'>
                            <label className='option-field'>
                                <CalendarDays size={16} />
                                <span>
                                    <small>When</small>
                                    <input
                                        aria-label='Travel date'
                                        type='text'
                                        placeholder='Add a date'
                                        onFocus={(e) => (e.currentTarget.type = 'date')}
                                    />
                                </span>
                                <ChevronDown size={14} />
                            </label>
                            <label className='option-field'>
                                <Users size={16} />
                                <span>
                                    <small>Seats</small>
                                    <select aria-label='Number of passengers'>
                                        <option>1 passenger</option>
                                        <option>2 passengers</option>
                                        <option>3 passengers</option>
                                    </select>
                                </span>
                                <ChevronDown size={14} />
                            </label>
                        </div>
                        <button
                            className='button button-burgundy search-button'
                            type='submit'
                        >
                            Explore rides <ArrowRight size={17} />
                        </button>
                        <p className='search-footnote'>
                            Thoughtful matches, made around you.
                        </p>
                    </form>
                    <div
                        className='map-orbit'
                        aria-hidden='true'
                    >
                        <ArrowDown size={13} /> OFF THE BEATEN PATH
                    </div>
                </div>
            </div>
        </section>
    );
}
