import { AlertTriangle, ArrowRight, BadgeCheck, Check, Clock3, Eye, LoaderCircle, RotateCcw, ShieldAlert, ShieldCheck, Ticket, Trash2, X } from 'lucide-react';
import type { Address } from 'viem';
import type { DemoEvent } from '../lib/data';

export default function EventModal({ event, account, onClose, onAction, onCancel, loading = false }: { event: DemoEvent; account: Address | null; onClose: () => void; onAction: () => void | Promise<void>; onCancel: () => void | Promise<void>; loading?: boolean }) {
  const soldOut = event.sold >= event.capacity;
  const isOrganizer = Boolean(account && event.organizer && account.toLowerCase() === event.organizer.toLowerCase());
  const isOnchain = event.source === 'onchain';
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="modal" onMouseDown={(e) => e.stopPropagation()}>
    <button className="modal-close" onClick={onClose}><X size={20} /></button>
    <div className={`modal-hero event-${event.image} ${event.imageUrl ? 'has-event-image' : ''}`}>{event.imageUrl ? <img className="modal-cover-image" src={event.imageUrl} alt={`${event.title} event cover`} /> : <><div className="event-grid" /><div className="event-orb" /></>}<div className="modal-hero-content"><span className="eyebrow">{event.cancelled ? 'CANCELLED' : isOnchain ? 'ONCHAIN EVENT' : 'SHOWCASE EVENT'}</span><h2>{event.title}</h2><p>{event.date} · {event.venue}</p></div></div>
    <div className="modal-content">
      {!isOnchain && <div className="showcase-banner"><Eye /> Showcase preview. This demo card does not submit wallet transactions.</div>}
      {event.cancelled && <div className="event-cancelled-banner"><AlertTriangle /> This event was cancelled. Ticket holders can claim a full refund from My Passes.</div>}
      <div className="verification-summary">
        <div className={`organizer-trust ${event.organizerVerified ? 'verified' : 'unverified'}`}>{event.organizerVerified ? <BadgeCheck /> : <ShieldAlert />}<span><strong>{event.organizerVerified ? 'Verified organizer' : 'Unverified organizer'}</strong><small>{event.organizerVerified ? 'Dojang verified + approved by Returnstile admin' : 'This organizer has not completed both verification checks'}</small></span></div>
        <div className={`access-trust ${event.mode === 'Verified' ? 'verified' : 'open'}`}><ShieldCheck /><span><strong>{event.mode === 'Verified' ? 'Dojang access' : 'Open access'}</strong><small>{event.mode === 'Verified' ? 'Only Dojang-verified wallets can secure a ticket' : 'Any wallet may secure one active ticket'}</small></span></div>
      </div>
      <p className="modal-description">{event.description}</p>
      <div className="trust-strip"><div><ShieldCheck /><span><strong>No private resale</strong><small>Transfer disabled at contract level</small></span></div><div><RotateCcw /><span><strong>Return-to-Queue</strong><small>Released at the original price</small></span></div><div><BadgeCheck /><span><strong>{event.mode} access</strong><small>{event.mode === 'Verified' ? 'Dojang gate required' : 'No identity requirement'}</small></span></div></div>
      <div className="ticket-panel"><div><span className="ticket-label">ENTRY</span><strong>{event.cancelled ? 'CANCELLED' : soldOut ? 'WAITLIST ACCESS' : 'GENERAL ADMISSION'}</strong><small><Clock3 size={14} /> Returns close before event start</small></div><div className="ticket-price"><span>PRICE</span><strong>{event.price}</strong><small>No resale markup</small></div></div>
      <div className="policy-list"><p><Check /> One active ticket per wallet</p><p><Check /> Wallet-bound, single-use entry</p><p><Check /> Identity documents are never uploaded</p></div>
      {!event.cancelled && isOnchain && <button className="primary-action" onClick={() => void onAction()} disabled={loading}>{loading ? <><LoaderCircle className="spin" /> Waiting for confirmation…</> : soldOut ? <><Ticket size={19} /> Join the waitlist</> : <>Secure ticket <ArrowRight size={19} /></>}</button>}
      {!event.cancelled && !isOnchain && <button className="primary-action showcase-action" disabled><Eye size={19} /> Showcase only — no transaction</button>}
      {isOrganizer && !event.cancelled && isOnchain && <button className="cancel-event-button" onClick={() => void onCancel()} disabled={loading}><Trash2 /> Cancel event and enable refunds</button>}
    </div>
  </section></div>;
}
