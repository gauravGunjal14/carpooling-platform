import { ArrowRight, MoveUpRight } from 'lucide-react';
export function FinalCTA() {
    return (
        <section
            className='final-cta'
            id='get-started'
        >
            <div className='container final-inner'>
                <div className='cta-star'>✳</div>
                <span className='eyebrow'>THE ROAD IS BETTER SHARED</span>
                <h2>
                    Your next journey
                    <br />
                    <em>could be shared.</em>
                </h2>
                <p>
                    Find a ride that feels right. Or make room for someone going your way.
                </p>
                <div className='final-buttons'>
                    <a
                        className='button button-burgundy'
                        href='/register?role=passenger'
                    >
                        Find a ride <ArrowRight size={17} />
                    </a>
                    <a
                        className='button button-outline'
                        href='/register?role=driver'
                    >
                        Offer a ride <MoveUpRight size={16} />
                    </a>
                </div>
                <span className='cta-route route-left'>
                    SF <i /> 37°46'N
                </span>
                <span className='cta-route route-right'>
                    YOUR NEXT STOP <i /> ?
                </span>
            </div>
        </section>
    );
}
