import { useMemo, useState } from 'react';
import { ArrowRight, BadgeCheck, CalendarDays, ChevronDown, CircleUserRound, LockKeyhole, Menu, RotateCcw, ShieldCheck, Sparkles, Ticket, Wallet, X } from 'lucide-react';
import type { Address } from 'viem';
import EventCard from './components/EventCard';
import EventModal from './components/EventModal';
import Logo from './components/Logo';
import { demoEvents, type DemoEvent } from './lib/data';
import { checkDojangVerification, connectInjectedWallet } from './lib/giwa';

type WalletState = {
  address: Address | null;
  verified: boolean | null;
  loading: boolean;
};

function shortAddress(address: Address) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export default function App() {
  const [selectedEvent, setSelectedEvent] = useState<DemoEvent | null>(null);
  const [wallet, setWallet] = useState<WalletState>({ address: null, verified: null, loading: false });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const availableCount = useMemo(() => demoEvents.filter((event) => event.sold < event.capacity).length, []);

  async function handleConnect() {
    setWallet((current) => ({ ...current, loading: true }));
    try {
      const address = await connectInjectedWallet();
      if (!address) {
        setToast('No injected wallet found. Demo mode is still available.');
        return;
      }
      setWallet({ address, verified: null, loading: true });
      const verified = await checkDojangVerification(address);
      setWallet({ address, verified, loading: false });
      setToast('Connected to GIWA Sepolia.');
    } catch {
      setToast('Wallet connection was cancelled or failed.');
    } finally {
      setWallet((current) => ({ ...current, loading: false }));
    }
  }

  function handleTicketAction() {
    if (!wallet.address) {
      setSelectedEvent(null);
      void handleConnect();
      return;
    }
    setToast(selectedEvent?.sold === selectedEvent?.capacity ? 'Waitlist request prepared in demo mode.' : 'Ticket purchase prepared in demo mode.');
    setSelectedEvent(null);
  }

  return (
    <main>
      <header className="topbar">
        <Logo />
        <nav className={mobileOpen ? 'nav-open' : ''}>
          <a href="#events" onClick={() => setMobileOpen(false)}>Discover</a>
          <a href="#protocol" onClick={() => setMobileOpen(false)}>How it works</a>
          <a href="#wallet" onClick={() => setMobileOpen(false)}>My passes</a>
          <a href="#organizers" onClick={() => setMobileOpen(false)}>For organizers</a>
        </nav>
        <div className="header-actions">
          <button className="network-pill"><span /> GIWA Sepolia <ChevronDown size={14} /></button>
          <button className="wallet-button" onClick={handleConnect} disabled={wallet.loading}>
            {wallet.address ? <><CircleUserRound size={17} /> {shortAddress(wallet.address)}</> : <><Wallet size={17} /> {wallet.loading ? 'Connecting…' : 'Connect wallet'}</>}
          </button>
          <button className="menu-button" onClick={() => setMobileOpen((open) => !open)} aria-label="Open menu">
            {mobileOpen ? <X /> : <Menu />}
          </button>
        </div>
      </header>

      <section className="hero">
        <div className="hero-noise" />
        <div className="hero-grid" />
        <div className="hero-content">
          <span className="hero-kicker"><Sparkles size={15} /> Anti-scalping, built into the ticket</span>
          <h1>Tickets return<br />to <em>fans.</em></h1>
          <p>Wallet-bound event access with fair returns, original-price reassignment and optional privacy-preserving verification on GIWA.</p>
          <div className="hero-actions">
            <a href="#events" className="primary-link">Explore events <ArrowRight size={18} /></a>
            <a href="#protocol" className="secondary-link">See the protocol</a>
          </div>
          <div className="hero-proof">
            <div><strong>0%</strong><span>resale markup</span></div>
            <div><strong>1×</strong><span>active ticket per wallet</span></div>
            <div><strong>0</strong><span>identity documents stored</span></div>
          </div>
        </div>
        <div className="hero-ticket-wrap" aria-hidden="true">
          <div className="hero-ticket-shadow" />
          <div className="hero-ticket">
            <div className="ticket-topline"><span>RETURNSTILE PASS</span><BadgeCheck size={18} /></div>
            <div className="ticket-visual"><span>R</span><div className="visual-rings" /></div>
            <p>NEON SEOUL LIVE</p>
            <strong>AUG 14 · 20:00</strong>
            <div className="ticket-meta"><span>GA · FLOOR</span><span>GIWA / 0042</span></div>
            <div className="ticket-dash" />
            <div className="ticket-status"><span><LockKeyhole size={16} /> WALLET BOUND</span><small>Return enabled</small></div>
          </div>
          <div className="floating-chip chip-one"><RotateCcw /> Return-to-Queue</div>
          <div className="floating-chip chip-two"><ShieldCheck /> No private resale</div>
        </div>
      </section>

      <section className="trust-marquee">
        <div><ShieldCheck /> Non-transferable ownership</div>
        <div><RotateCcw /> Original-price reassignment</div>
        <div><BadgeCheck /> Optional Dojang verification</div>
        <div><LockKeyhole /> No identity documents stored</div>
      </section>

      <section className="events-section" id="events">
        <div className="section-heading">
          <div>
            <span className="eyebrow">LIVE ON TESTNET</span>
            <h2>Events worth showing up for.</h2>
          </div>
          <div className="availability"><span>{availableCount}</span> events with open access</div>
        </div>
        <div className="events-grid">
          {demoEvents.map((event) => <EventCard key={event.id} event={event} onSelect={setSelectedEvent} />)}
        </div>
      </section>

      <section className="protocol-section" id="protocol">
        <div className="protocol-copy">
          <span className="eyebrow">THE RETURN-TO-QUEUE PROTOCOL</span>
          <h2>A ticket can leave your wallet. It just can’t enter a reseller’s.</h2>
          <p>When plans change, the holder returns the ticket to the event contract. The ticket is refunded, retired and offered to the next eligible fan at the same original price.</p>
          <a href="#events">Try the demo flow <ArrowRight size={17} /></a>
        </div>
        <div className="flow-card">
          <div className="flow-step active"><span>01</span><Ticket /><div><strong>Claim</strong><small>A wallet receives one active pass</small></div></div>
          <div className="flow-line" />
          <div className="flow-step"><span>02</span><RotateCcw /><div><strong>Return</strong><small>The holder receives refundable credit</small></div></div>
          <div className="flow-line" />
          <div className="flow-step"><span>03</span><CalendarDays /><div><strong>Reassign</strong><small>The next fan claims at face value</small></div></div>
        </div>
      </section>

      <section className="wallet-preview" id="wallet">
        <div className="phone-shell">
          <div className="phone-bar"><span>9:41</span><span>GIWA</span></div>
          <div className="phone-head"><div><small>MY PASSES</small><strong>Ready when you are.</strong></div><CircleUserRound /></div>
          <div className="mobile-pass">
            <div className="mobile-pass-art"><span>R</span></div>
            <div className="mobile-pass-info"><small>AUG 14 · 20:00</small><strong>Neon Seoul Live</strong><span>Nodeul Island · GA Floor</span></div>
            <div className="mobile-pass-tags"><span><LockKeyhole /> Wallet bound</span><span><RotateCcw /> Return open</span></div>
            <button>Show entry code</button>
          </div>
        </div>
        <div className="wallet-copy">
          <span className="eyebrow">WALLET-READY BY DESIGN</span>
          <h2>Simple enough to live inside GIWA Wallet.</h2>
          <p>No NFT jargon. No resale marketplace. No identity upload. Just passes, clear return rules and a secure entry action.</p>
          <div className="wallet-points">
            <p><BadgeCheck /> Open or optional verified events</p>
            <p><ShieldCheck /> Privacy-preserving Dojang status checks</p>
            <p><RotateCcw /> One-tap returns to the official queue</p>
          </div>
        </div>
      </section>

      <section className="organizer-cta" id="organizers">
        <div>
          <span className="eyebrow">FOR ORGANIZERS</span>
          <h2>Fill the room, not the resale market.</h2>
          <p>Create a fair-access event, choose open or verified entry and keep every released seat inside the official queue.</p>
        </div>
        <button onClick={() => setToast('Organizer studio is queued for the next build step.')}>Open organizer studio <ArrowRight /></button>
      </section>

      <footer>
        <Logo />
        <p>Privacy-preserving anti-scalping tickets on GIWA Sepolia.</p>
        <span>Prototype v0.1 · 2026</span>
      </footer>

      {selectedEvent && <EventModal event={selectedEvent} onClose={() => setSelectedEvent(null)} onAction={handleTicketAction} />}
      {toast && <button className="toast" onClick={() => setToast(null)}>{toast}<X size={16} /></button>}
    </main>
  );
}
