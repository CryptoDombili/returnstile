import { ArrowUpRight, BadgeCheck, Eye, MapPin, ShieldAlert, ShieldCheck } from 'lucide-react';
import type { DemoEvent } from '../lib/data';

export default function EventCard({ event, onSelect }: { event: DemoEvent; onSelect: (event: DemoEvent) => void }) {
  const fill = Math.min(100, Math.round((event.sold / event.capacity) * 100));
  const isOnchain = event.source === 'onchain';
  return (
    <article className={`event-card event-${event.image}`} onClick={() => onSelect(event)}>
      <div className={`event-art ${event.imageUrl ? 'has-event-image' : ''}`}>
        {event.imageUrl ? <img className="event-cover-image" src={event.imageUrl} alt={`${event.title} event cover`} loading="lazy" /> : <><div className="event-grid" /><div className="event-orb" /></>}
        <span className={`event-source-badge ${isOnchain ? 'onchain' : 'showcase'}`}>{isOnchain ? 'ONCHAIN' : 'SHOWCASE'}</span>
        <button className="icon-button" aria-label={`Open ${event.title}`}>
          <ArrowUpRight size={18} />
        </button>
      </div>
      <div className="event-body">
        <div className="event-title-row">
          <div><h3>{event.title}</h3><p>{event.date}</p></div>
          {!isOnchain && <span className="showcase-pill"><Eye size={13} /> Demo</span>}
        </div>
        <p className="venue"><MapPin size={15} /> {event.venue}</p>
        <div className="event-badge-row">
          <span className={`organizer-pill ${event.organizerVerified ? 'verified' : 'unverified'}`}>
            {event.organizerVerified ? <BadgeCheck size={13} /> : <ShieldAlert size={13} />}
            {event.organizerVerified ? 'Verified organizer' : 'Unverified organizer'}
          </span>
          <span className={`access-pill ${event.mode === 'Verified' ? 'verified' : 'open'}`}>
            <ShieldCheck size={13} /> {event.mode === 'Verified' ? 'Dojang access' : 'Open access'}
          </span>
        </div>
        <div className="event-progress-row"><div className="progress-track"><span style={{ width: `${fill}%` }} /></div><span>{fill}%</span></div>
        <div className="event-footer"><span>{event.sold.toLocaleString()} / {event.capacity.toLocaleString()} claimed</span><strong>{event.price}</strong></div>
      </div>
    </article>
  );
}
