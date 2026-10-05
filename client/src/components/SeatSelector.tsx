import {
    BadgeCheck,
    Check,
    LockKeyhole,
    ShieldCheck,
    Star,
    UserCheck,
} from 'lucide-react';
import type { SeatStatusInfo } from '../types/rides';

type Props = {
    totalSeats: number;
    seats: SeatStatusInfo[];
    selectedSeats: number[];
    onToggleSelectSeat: (seatNumber: number) => void;
    inspectedSeat: SeatStatusInfo | null;
    onInspectSeat: (seat: SeatStatusInfo | null) => void;
    disabled?: boolean;
};

export function SeatSelector({
    totalSeats,
    seats,
    selectedSeats,
    onToggleSelectSeat,
    inspectedSeat,
    onInspectSeat,
    disabled = false,
}: Props) {
    const seatMap = new Map<number, SeatStatusInfo>(seats.map((s) => [s.seatNumber, s]));

    // Front seats: Seat 1
    const frontSeat = seatMap.get(1);

    // Back seats: Seat 2, 3, 4, 5, 6...
    const backSeats: (SeatStatusInfo | undefined)[] = [];
    for (let i = 2; i <= Math.max(totalSeats, 4); i++) {
        if (i <= totalSeats) {
            backSeats.push(seatMap.get(i));
        }
    }

    function renderSeatButton(seatNum: number, seatInfo?: SeatStatusInfo) {
        if (!seatInfo && seatNum > totalSeats) return null;
        const isOccupied = seatInfo?.isOccupied ?? false;
        const isSelected = selectedSeats.includes(seatNum);
        const isInspected = inspectedSeat?.seatNumber === seatNum;
        const isMySeat = seatInfo?.isMySeat ?? false;

        let seatClass = 'seat';
        if (isSelected) seatClass += ' chosen';
        if (isOccupied) seatClass += ' occupied';
        if (isInspected) seatClass += ' inspected';
        if (isMySeat) seatClass += ' my-seat';

        return (
            <button
                key={seatNum}
                type='button'
                className={seatClass}
                disabled={disabled}
                onClick={() => {
                    if (isOccupied) {
                        onInspectSeat(isInspected ? null : (seatInfo ?? null));
                    } else {
                        onToggleSelectSeat(seatNum);
                        onInspectSeat(null);
                    }
                }}
                aria-label={`Seat ${seatNum}, ${
                    isMySeat
                        ? 'Booked by you'
                        : isOccupied
                          ? 'Occupied, click to view anonymous trust'
                          : isSelected
                            ? 'Selected'
                            : 'Available'
                }`}
                aria-pressed={isSelected}
            >
                {isOccupied && <span className='occupant-mark'>●</span>}
                {isMySeat ? <UserCheck size={13} /> : seatNum}
            </button>
        );
    }

    return (
        <div className='seat-selector-container'>
            <div className='seat-demo'>
                <div className='seat-demo-left'>
                    <div className='seat-demo-head'>
                        <div>
                            <span className='eyebrow'>INTERACTIVE SEAT MAP</span>
                            <h3>Select your seats</h3>
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
                                {renderSeatButton(1, frontSeat)}
                            </div>
                            <div className='car-back'>
                                {backSeats.map((s, idx) => renderSeatButton(idx + 2, s))}
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
                        <span>i</span> Click an occupied seat to inspect its anonymous
                        trust profile.
                    </p>
                </div>
                <div className='seat-demo-right'>
                    {inspectedSeat?.isOccupied && inspectedSeat.trustSummary ? (
                        <div>
                            <span className='eyebrow'>OCCUPIED SEAT · ANONYMOUS</span>
                            <article className='anonymous-card'>
                                <div className='anon-top'>
                                    <div className='anon-avatar'>
                                        <ShieldCheck size={22} />
                                    </div>
                                    <div>
                                        <b>
                                            Seat {inspectedSeat.seatNumber} · Verified
                                            traveller
                                        </b>
                                        <small>Identity stays private</small>
                                    </div>
                                    <LockKeyhole
                                        size={16}
                                        className='anon-lock'
                                    />
                                </div>
                                <div className='anon-score'>
                                    <div>
                                        <small>TRUST SCORE</small>
                                        <strong>
                                            {inspectedSeat.trustSummary.trustScore}
                                            <span> / 100</span>
                                        </strong>
                                    </div>
                                    <div className='anon-meter'>
                                        <i
                                            style={{
                                                width: `${inspectedSeat.trustSummary.trustScore}%`,
                                            }}
                                        />
                                    </div>
                                </div>
                                <div className='anon-stats'>
                                    <span>
                                        <BadgeCheck size={14} />{' '}
                                        {inspectedSeat.trustSummary.isVerified
                                            ? 'Verified'
                                            : 'Registered'}
                                    </span>
                                    <span>
                                        <Check size={14} />{' '}
                                        {inspectedSeat.trustSummary.completedRides}{' '}
                                        completed rides
                                    </span>
                                    <span>
                                        <Star
                                            size={13}
                                            fill='currentColor'
                                        />{' '}
                                        {inspectedSeat.trustSummary.rating} rating
                                    </span>
                                </div>
                            </article>
                            <p className='privacy-promise'>
                                <LockKeyhole size={14} /> Zero personal data shown. Names,
                                phone numbers, and identity documents are never shared.
                            </p>
                        </div>
                    ) : selectedSeats.length > 0 ? (
                        <div className='selected-summary-card'>
                            <span className='eyebrow'>READY TO BOOK</span>
                            <div className='empty-seat-card'>
                                <span className='empty-seat-icon'>
                                    <Check size={20} />
                                </span>
                                <h3>
                                    Seat {selectedSeats.join(', ')}{' '}
                                    {selectedSeats.length > 1 ? 'selected' : 'selected'}
                                </h3>
                                <p>
                                    You have chosen {selectedSeats.length} seat
                                    {selectedSeats.length > 1 ? 's' : ''}. Complete your
                                    request below to notify the driver.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className='empty-seat-card'>
                            <span className='empty-seat-icon'>
                                <Check size={20} />
                            </span>
                            <h3>Choose your seat</h3>
                            <p>
                                Click any available seat on the car layout to select it
                                for booking.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
