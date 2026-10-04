import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { Hero } from '../sections/Hero';
import { HowItWorks } from '../sections/HowItWorks';
import { SmartMatching } from '../sections/SmartMatching';
import { SafetySection } from '../sections/SafetySection';
import { WomenOnlySection } from '../sections/WomenOnlySection';
import { SeatTrustDemo } from '../sections/SeatTrustDemo';
import { ForEveryone } from '../sections/ForEveryone';
import { ProSection } from '../sections/ProSection';
import { FinalCTA } from '../sections/FinalCTA';

export function LandingPage() {
    return (
        <>
            <Navbar />
            <main>
                <Hero />
                <HowItWorks />
                <SmartMatching />
                <SafetySection />
                <WomenOnlySection />
                <SeatTrustDemo />
                <ForEveryone />
                <ProSection />
                <FinalCTA />
            </main>
            <Footer />
        </>
    );
}
