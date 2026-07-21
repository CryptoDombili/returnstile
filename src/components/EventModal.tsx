import { ArrowRight, BadgeCheck, Check, Clock3, RotateCcw, ShieldCheck, Ticket, X } from 'lucide-react';
import type { DemoEvent } from '../lib/data';

export default function EventModal({ event, onClose, onAction }: { event: DemoEvent; onClose: () => void; onAction: () => void }) {
  const soldOut = event.sold >= event.capacity;
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close"><X size={20} /></button>
        <div className={`modal-hero event-${event.image}`}>
          <div className="event-grid" />
          <div className="event-orb" />
          <div className="modal-hero-content">
            <span className="eyebrow">{event.category}</span>
            <h2>{event.title}</h2>
            <p>{event.date} · {event.venue}</p>
          </div>
        </div>
        <div className="modal-content">
          <p className="modal-description">{event.description}</p>
          <div className="trust-strip">
            <div><ShieldCheck /><span><strong>No private resale</strong><small>Transfer disabled at contract level</small></span></div>
            <div><RotateCcw /><span><strong>Return-to-Queue</strong><small>Released at the original price</small></span></div>
            <div><BadgeCheck /><span><strong>{event.mode} access</strong><small>{event.mode === 'Verified' ? 'Optional Dojang gate' : 'No identity requirement'}</small></span></div>
          </div>
          <div className="ticket-panel">
            <div>
              <span className="ticket-label">ENTRY</span>
              <strong>{soldOut ? 'WAITLIST ACCESS' : 'GENERAL ADMISSION'}</strong>
              <small><Clock3 size={14} /> Returns close 24 hours before start</small>
            </div>
            <div className="ticket-price">
              <span>PRICE</span>
              <strong>{event.price}</strong>
              <small>No resale markup</small>
            </div>
          </div>
          <div className="policy-list">
            <p><Check /> One active ticket per wallet</p>
            <p><Check /> Wallet-bound, single-use entry</p>
            <p><Check /> Identity documents are never uploaded</p>
          </div>
          <button className="primary-action" onClick={onAction}>
            {soldOut ? <><Ticket size={19} /> Join the waitlist</> : <>Secure ticket <ArrowRight size={19} /></>}
          </button>
        </div>
      </section>
    </div>
  );
}
