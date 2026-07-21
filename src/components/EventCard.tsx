import { ArrowUpRight, BadgeCheck, MapPin } from 'lucide-react';
import type { DemoEvent } from '../lib/data';

export default function EventCard({ event, onSelect }: { event: DemoEvent; onSelect: (event: DemoEvent) => void }) {
  const fill = Math.min(100, Math.round((event.sold / event.capacity) * 100));
  return (
    <article className={`event-card event-${event.image}`} onClick={() => onSelect(event)}>
      <div className="event-art">
        <div className="event-grid" />
        <div className="event-orb" />
        <span className="event-category">{event.category}</span>
        <button className="icon-button" aria-label={`Open ${event.title}`}>
          <ArrowUpRight size={18} />
        </button>
      </div>
      <div className="event-body">
        <div className="event-title-row">
          <div>
            <h3>{event.title}</h3>
            <p>{event.date}</p>
          </div>
          <span className={`mode-pill mode-${event.mode.toLowerCase()}`}>
            {event.mode === 'Verified' && <BadgeCheck size={14} />} {event.mode}
          </span>
        </div>
        <p className="venue"><MapPin size={15} /> {event.venue}</p>
        <div className="event-progress-row">
          <div className="progress-track"><span style={{ width: `${fill}%` }} /></div>
          <span>{fill}%</span>
        </div>
        <div className="event-footer">
          <span>{event.sold.toLocaleString()} / {event.capacity.toLocaleString()} claimed</span>
          <strong>{event.price}</strong>
        </div>
      </div>
    </article>
  );
}
