import { lazy, Suspense } from 'react';
import type { RideLocation } from '../types/rides';

const RideMap = lazy(() =>
    import('./RideMap').then((module) => ({ default: module.RideMap })),
);

type Props = {
    pickup: RideLocation | null;
    destination: RideLocation | null;
};

export function LazyRideMap(props: Props) {
    return (
        <Suspense
            fallback={
                <div
                    className='ride-map-loading'
                    role='status'
                >
                    Loading route map…
                </div>
            }
        >
            <RideMap {...props} />
        </Suspense>
    );
}
