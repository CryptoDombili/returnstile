import { AlertTriangle, BadgeCheck, CalendarDays, LoaderCircle, LockKeyhole, RotateCcw, ShieldAlert, ShieldCheck, Ticket } from 'lucide-react';
import type { AccountPass } from '../lib/returnstile';

export default function MyPasses({ connected, passes, loading, returningTicket, onConnect, onReturn, onCancellationRefund }: { connected: boolean; passes: AccountPass[]; loading: boolean; returningTicket: bigint | null; onConnect: () => void; onReturn: (ticketId: bigint) => void | Promise<void>; onCancellationRefund: (ticketId: bigint) => void | Promise<void> }) {
  return <section className="my-passes-section" id="wallet">
    <div className="section-heading"><div><span className="eyebrow">MY PASSES</span><h2>Your tickets, in one place.</h2></div><div className="availability">{connected ? `${passes.length} active` : 'wallet required'}</div></div>
    {!connected ? <div className="passes-empty"><Ticket /><h3>Connect your wallet</h3><p>Your active Returnstile tickets will appear here.</p><button onClick={onConnect}>Connect wallet</button></div>
    : loading ? <div className="passes-empty"><LoaderCircle className="spin" /><p>Reading your GIWA passes…</p></div>
    : passes.length === 0 ? <div className="passes-empty"><Ticket /><h3>No active passes yet.</h3><p>Secure a ticket from an onchain event and it will show here.</p><a href="#events">Explore events</a></div>
    : <div className="passes-grid">{passes.map((pass) => <article className={`pass-card ${pass.cancelled ? 'pass-cancelled' : ''}`} key={pass.ticketId.toString()}>
      <div className="pass-art">{pass.imageUrl ? <img src={pass.imageUrl} alt={pass.title} /> : <span>R</span>}</div>
      <div className="pass-copy"><small>PASS #{pass.ticketId.toString()} · EVENT #{pass.eventId}</small><h3>{pass.title}</h3><p><CalendarDays /> {pass.date}</p><p>{pass.venue}</p>
        <div className="pass-verification-tags"><span className={pass.organizerVerified ? 'verified' : 'unverified'}>{pass.organizerVerified ? <BadgeCheck /> : <ShieldAlert />}{pass.organizerVerified ? 'Verified organizer' : 'Unverified organizer'}</span><span className={pass.verifiedOnly ? 'verified' : 'open'}><ShieldCheck />{pass.verifiedOnly ? 'Dojang access' : 'Open access'}</span></div>
        {pass.cancelled ? <div className="cancelled-notice"><AlertTriangle /> Event cancelled · Full refund available</div> : <div className="pass-tags"><span><LockKeyhole /> Wallet bound</span><span><RotateCcw /> Return enabled</span></div>}
      </div>
      <button className={pass.cancelled ? 'claim-refund-pass' : 'return-pass'} onClick={() => void (pass.cancelled ? onCancellationRefund(pass.ticketId) : onReturn(pass.ticketId))} disabled={returningTicket === pass.ticketId}>{returningTicket === pass.ticketId ? 'Processing…' : pass.cancelled ? 'Claim full refund' : 'Return ticket'}</button>
    </article>)}</div>}
  </section>;
}
