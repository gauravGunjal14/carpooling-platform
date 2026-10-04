import { useEffect } from 'react';
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import L, { type LatLngTuple } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { RideLocation } from '../types/rides';

type Props = {
    pickup: RideLocation | null;
    destination: RideLocation | null;
};

const pickupIcon = L.divIcon({
    className: 'ride-map-marker ride-map-marker-pickup',
    html: '<span></span>',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
});
const destinationIcon = L.divIcon({
    className: 'ride-map-marker ride-map-marker-destination',
    html: '<span></span>',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
});

function FitRideBounds({ points }: { points: LatLngTuple[] }) {
    const map = useMap();
    useEffect(() => {
        if (points.length > 1) {
            map.fitBounds(L.latLngBounds(points), { padding: [32, 32], maxZoom: 12 });
        } else if (points.length === 1) {
            map.setView(points[0], 12);
        }
    }, [map, points]);
    return null;
}

export function RideMap({ pickup, destination }: Props) {
    const points: LatLngTuple[] = [];
    if (pickup) points.push([pickup.latitude, pickup.longitude]);
    if (destination) points.push([destination.latitude, destination.longitude]);
    const center: LatLngTuple = points[0] ?? [19.076, 72.8777];

    return (
        <section
            className='ride-map-section'
            aria-label='Route map preview'
        >
            <div className='ride-map-heading'>
                <span className='eyebrow'>ROUTE PREVIEW</span>
                <span>Approximate connection · not a navigable route</span>
            </div>
            <MapContainer
                className='ride-map'
                center={center}
                zoom={points.length ? 11 : 5}
                scrollWheelZoom={false}
                keyboard={true}
                aria-label='Map showing the selected pickup and destination'
            >
                <TileLayer
                    url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
                />
                <FitRideBounds points={points} />
                {pickup && (
                    <Marker
                        position={[pickup.latitude, pickup.longitude]}
                        icon={pickupIcon}
                    >
                        <Popup>Pickup · {pickup.displayName}</Popup>
                    </Marker>
                )}
                {destination && (
                    <Marker
                        position={[destination.latitude, destination.longitude]}
                        icon={destinationIcon}
                    >
                        <Popup>Destination · {destination.displayName}</Popup>
                    </Marker>
                )}
                {points.length === 2 && (
                    <Polyline
                        positions={points}
                        pathOptions={{ color: '#742b49', weight: 3, dashArray: '7 8' }}
                    />
                )}
            </MapContainer>
            <p className='ride-map-accessible-summary'>
                {pickup ? `Pickup: ${pickup.displayName}.` : 'Choose a pickup place.'}{' '}
                {destination
                    ? `Destination: ${destination.displayName}.`
                    : 'Choose a destination place.'}
            </p>
        </section>
    );
}
