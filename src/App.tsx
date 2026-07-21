import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, BadgeCheck, CalendarDays, ChevronDown, CircleUserRound, LockKeyhole, Menu, RotateCcw, ShieldCheck, Sparkles, Ticket, Wallet, X } from 'lucide-react';
import { zeroAddress, type Address } from 'viem';
import AccountModal from './components/AccountModal';
import EventCard from './components/EventCard';
import EventModal from './components/EventModal';
import MyPasses from './components/MyPasses';
import OrganizerStudio from './components/OrganizerStudio';
import Logo from './components/Logo';
import { demoEvents, type DemoEvent } from './lib/data';
import { checkDojangVerification, connectInjectedWallet } from './lib/giwa';
import {
  buyReturnstileTicket,
  cancelReturnstileEvent,
  claimCancellationRefund,
  formatOnchainEventDate,
  formatOnchainPrice,
  joinReturnstileWaitlist,
  readAccountPasses,
  readRefundCredits,
  readProtocolOwner,
  readOrganizerAdminApproval,
  setOrganizerApproval,
  readReturnstileEvents,
  returnReturnstileTicket,
  withdrawReturnstileRefund,
  type AccountPass,
  type RefundBalance,
} from './lib/returnstile';

type WalletState = { address: Address | null; verified: boolean | null; loading: boolean; };

function shortAddress(address: Address) { return `${address.slice(0, 6)}…${address.slice(-4)}`; }
function errorMessage(cause: unknown) {
  const message = cause instanceof Error ? cause.message : 'Transaction failed.';
  if (message.includes('AlreadyHasActiveTicket')) return 'This wallet already has an active ticket for the event.';
  if (message.includes('IncorrectPayment')) return 'The wallet payment amount did not match the ticket price.';
  if (message.includes('NotVerified')) return 'This event requires Dojang verification.';
  if (message.includes('EventSoldOut')) return 'The event is sold out. Join the waitlist instead.';
  if (message.includes('ReturnWindowClosed')) return 'The ticket return window is closed.';
  if (message.includes('User rejected')) return 'The wallet transaction was cancelled.';
  if (message.includes('OwnableUnauthorizedAccount')) return 'Only the contract owner wallet can approve or revoke organizers.';
  return message.length > 180 ? 'The transaction failed. Check the wallet and try again.' : message;
}

const ARCHIVED_EVENT_TITLES = new Set(['morasa', 'my father bill gates']);
const isArchivedEvent = (title: string) => ARCHIVED_EVENT_TITLES.has(title.trim().toLowerCase());

export default function App() {
  const [selectedEvent, setSelectedEvent] = useState<DemoEvent | null>(null);
  const [wallet, setWallet] = useState<WalletState>({ address: null, verified: null, loading: false });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [organizerOpen, setOrganizerOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [onchainEvents, setOnchainEvents] = useState<DemoEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [passes, setPasses] = useState<AccountPass[]>([]);
  const [passesLoading, setPassesLoading] = useState(false);
  const [refundCredits, setRefundCredits] = useState<RefundBalance[]>([]);
  const [eventFilter, setEventFilter] = useState<'all' | 'verified' | 'unverified'>('all');
  const [ticketActionLoading, setTicketActionLoading] = useState(false);
  const [returningTicket, setReturningTicket] = useState<bigint | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [protocolOwner, setProtocolOwner] = useState<Address | null>(null);
  const [approvingOrganizer, setApprovingOrganizer] = useState(false);
  const [organizerAdminNotice, setOrganizerAdminNotice] = useState<string | null>(null);

  const loadOnchainEvents = useCallback(async () => {
    setEventsLoading(true);
    try {
      const records = await readReturnstileEvents();
      setOnchainEvents(records.filter((event) => !isArchivedEvent(event.title)).map((event, index) => ({
        id: 100000 + event.id, onchainId: event.id, source: 'onchain' as const, title: event.title,
        category: event.cancelled ? 'CANCELLED' : event.paused ? 'PAUSED' : 'ONCHAIN', date: formatOnchainEventDate(event.startsAt), venue: event.venue,
        price: formatOnchainPrice(event.priceWei, event.paymentAsset), priceWei: event.priceWei, paymentToken: event.paymentToken, paymentAsset: event.paymentAsset, sold: event.activeTickets, capacity: event.capacity,
        mode: event.verifiedOnly ? 'Verified' as const : 'Open' as const, accent: index % 2 === 0 ? 'lime' : 'violet',
        image: index % 2 === 0 ? 'builders' : 'neon',
        description: `Live GIWA Sepolia event #${event.id}. ${event.releasedSeats} returned seat${event.releasedSeats === 1 ? '' : 's'} currently available for protocol reassignment.`,
        imageUrl: event.imageUrl, returnDeadline: event.returnDeadline, releasedSeats: event.releasedSeats, organizer: event.organizer, organizerVerified: event.organizerVerified, cancelled: event.cancelled,
      })));
    } catch { setToast('Onchain events could not be loaded. Demo events remain available.'); }
    finally { setEventsLoading(false); }
  }, []);

  const loadAccount = useCallback(async (address: Address | null) => {
    if (!address) { setPasses([]); setRefundCredits([]); return; }
    setPassesLoading(true);
    try {
      const [nextPasses, nextRefunds] = await Promise.all([readAccountPasses(address), readRefundCredits(address)]);
      setPasses(nextPasses); setRefundCredits(nextRefunds);
    } catch { setToast('Account passes could not be read from GIWA Sepolia.'); }
    finally { setPassesLoading(false); }
  }, []);

  const refreshAll = useCallback(async () => {
    await loadOnchainEvents();
    await loadAccount(wallet.address);
  }, [loadAccount, loadOnchainEvents, wallet.address]);

  useEffect(() => { void loadOnchainEvents(); void readProtocolOwner().then(setProtocolOwner).catch(() => setProtocolOwner(null)); }, [loadOnchainEvents]);
  useEffect(() => { void loadAccount(wallet.address); }, [loadAccount, wallet.address]);
  useEffect(() => {
    const ethereum = window.ethereum;
    if (!ethereum?.on) return;
    const listener = (...args: unknown[]) => {
      const accounts = args[0] as string[] | undefined;
      const address = accounts?.[0] as Address | undefined;
      setWallet({ address: address ?? null, verified: null, loading: false });
      setAccountOpen(false);
    };
    ethereum.on('accountsChanged', listener);
    return () => ethereum.removeListener?.('accountsChanged', listener);
  }, []);

  const allEvents = useMemo(() => [...onchainEvents, ...demoEvents], [onchainEvents]);
  const filteredEvents = useMemo(() => allEvents.filter((event) => eventFilter === 'all' || (eventFilter === 'verified' ? event.organizerVerified === true : event.organizerVerified !== true)), [allEvents, eventFilter]);
  const availableCount = useMemo(() => allEvents.filter((event) => event.sold < event.capacity).length, [allEvents]);

  async function handleConnect() {
    setWallet((current) => ({ ...current, loading: true }));
    try {
      const address = await connectInjectedWallet();
      if (!address) { setToast('No injected wallet found. Demo mode is still available.'); return; }
      setWallet({ address, verified: null, loading: true });
      const verified = await checkDojangVerification(address);
      setWallet({ address, verified, loading: false });
      setToast('Connected to GIWA Sepolia.');
    } catch { setToast('Wallet connection was cancelled or failed.'); }
    finally { setWallet((current) => ({ ...current, loading: false })); }
  }

  async function handleTicketAction() {
    if (!selectedEvent) return;
    if (!wallet.address) { setSelectedEvent(null); await handleConnect(); return; }
    if (selectedEvent.source !== 'onchain' || !selectedEvent.onchainId) {
      setToast(selectedEvent.sold >= selectedEvent.capacity ? 'Waitlist request prepared in demo mode.' : 'Ticket purchase prepared in demo mode.');
      setSelectedEvent(null); return;
    }
    setTicketActionLoading(true);
    try {
      if (selectedEvent.sold >= selectedEvent.capacity) {
        const hash = await joinReturnstileWaitlist(wallet.address, selectedEvent.onchainId);
        setToast(`Waitlist joined · ${hash.slice(0, 10)}…`);
      } else {
        const hash = await buyReturnstileTicket(wallet.address, selectedEvent.onchainId, selectedEvent.priceWei ?? 0n, selectedEvent.paymentToken ?? zeroAddress);
        setToast(`Ticket secured · ${hash.slice(0, 10)}…`);
      }
      setSelectedEvent(null);
      await refreshAll();
      document.getElementById('wallet')?.scrollIntoView({ behavior: 'smooth' });
    } catch (cause) { setToast(errorMessage(cause)); }
    finally { setTicketActionLoading(false); }
  }

  async function handleReturn(ticketId: bigint) {
    if (!wallet.address) return;
    setReturningTicket(ticketId);
    try {
      const hash = await returnReturnstileTicket(wallet.address, ticketId);
      setToast(`Ticket returned · ${hash.slice(0, 10)}… Refund credit is ready.`);
      await refreshAll();
    } catch (cause) { setToast(errorMessage(cause)); }
    finally { setReturningTicket(null); }
  }

  async function handleCancellationRefund(ticketId: bigint) {
    if (!wallet.address) return;
    setReturningTicket(ticketId);
    try {
      const hash = await claimCancellationRefund(wallet.address, ticketId);
      setToast(`Cancellation refund prepared · ${hash.slice(0, 10)}… Withdraw it from your account.`);
      await refreshAll();
    } catch (cause) { setToast(errorMessage(cause)); }
    finally { setReturningTicket(null); }
  }

  async function handleCancelEvent() {
    if (!wallet.address || !selectedEvent?.onchainId) return;
    setTicketActionLoading(true);
    try {
      const hash = await cancelReturnstileEvent(wallet.address, selectedEvent.onchainId);
      setToast(`Event cancelled · ${hash.slice(0, 10)}… Ticket holders can claim full refunds.`);
      setSelectedEvent(null);
      await refreshAll();
    } catch (cause) { setToast(errorMessage(cause)); }
    finally { setTicketActionLoading(false); }
  }

  async function handleWithdraw(token: Address) {
    if (!wallet.address) return;
    setWithdrawing(true);
    try {
      const hash = await withdrawReturnstileRefund(wallet.address, token);
      setToast(`Refund withdrawn · ${hash.slice(0, 10)}…`);
      await loadAccount(wallet.address);
    } catch (cause) { setToast(errorMessage(cause)); }
    finally { setWithdrawing(false); }
  }

  async function handleOrganizerApproval(organizer: Address, approved: boolean) {
    if (!wallet.address) return;
    setApprovingOrganizer(true);
    setOrganizerAdminNotice(null);
    try {
      const hash = await setOrganizerApproval(wallet.address, organizer, approved);
      const adminApproved = await readOrganizerAdminApproval(organizer);
      if (!approved || !adminApproved) {
        setOrganizerAdminNotice('Admin approval revoked onchain. This organizer is now unverified.');
        setToast(`Organizer approval revoked · ${hash.slice(0, 10)}…`);
      } else {
        const dojangVerified = await checkDojangVerification(organizer);
        const message = dojangVerified
          ? 'Admin approval confirmed onchain. This wallet is also Dojang verified, so the green Verified organizer badge is active.'
          : 'Admin approval confirmed onchain. The wallet still needs Dojang verification before the green Verified organizer badge appears.';
        setOrganizerAdminNotice(message);
        setToast(`Organizer approval confirmed · ${hash.slice(0, 10)}…`);
      }
      await loadOnchainEvents();
    } catch (cause) {
      const message = errorMessage(cause);
      setOrganizerAdminNotice(message);
      setToast(message);
    } finally { setApprovingOrganizer(false); }
  }

  function disconnectLocally() {
    setWallet({ address: null, verified: null, loading: false });
    setAccountOpen(false); setPasses([]); setRefundCredits([]);
    setToast('Wallet disconnected from this page.');
  }

  return (
    <main>
      <header className="topbar"><Logo /><nav className={mobileOpen ? 'nav-open' : ''}>
        <a href="#events" onClick={() => setMobileOpen(false)}>Discover</a><a href="#protocol" onClick={() => setMobileOpen(false)}>How it works</a><a href="#wallet" onClick={() => setMobileOpen(false)}>My passes</a><a href="#organizers" onClick={() => setMobileOpen(false)}>For organizers</a>
      </nav><div className="header-actions"><button className="network-pill"><span /> GIWA Sepolia <ChevronDown size={14} /></button>
        <button className="wallet-button" onClick={() => { if (wallet.address) { setOrganizerAdminNotice(null); setAccountOpen(true); } else void handleConnect(); }} disabled={wallet.loading}>{wallet.address ? <><CircleUserRound size={17} /> {shortAddress(wallet.address)}</> : <><Wallet size={17} /> {wallet.loading ? 'Connecting…' : 'Connect wallet'}</>}</button>
        <button className="menu-button" onClick={() => setMobileOpen((open) => !open)} aria-label="Open menu">{mobileOpen ? <X /> : <Menu />}</button></div></header>

      <section className="hero"><div className="hero-noise" /><div className="hero-grid" /><div className="hero-content"><span className="hero-kicker"><Sparkles size={15} /> Anti-scalping, built into the ticket</span><h1>Tickets return<br />to <em>fans.</em></h1><p>Wallet-bound event access with fair returns, original-price reassignment and optional privacy-preserving verification on GIWA.</p><div className="hero-actions"><a href="#events" className="primary-link">Explore events <ArrowRight size={18} /></a><a href="#protocol" className="secondary-link">See the protocol</a></div><div className="hero-proof"><div><strong>0%</strong><span>resale markup</span></div><div><strong>1×</strong><span>active ticket per wallet</span></div><div><strong>0</strong><span>identity documents stored</span></div></div></div>
        <div className="hero-ticket-wrap" aria-hidden="true"><div className="hero-ticket-shadow" /><div className="hero-ticket"><div className="ticket-topline"><span>RETURNSTILE PASS</span><BadgeCheck size={18} /></div><div className="ticket-visual"><span>R</span><div className="visual-rings" /></div><p>NEON SEOUL LIVE</p><strong>AUG 14 · 20:00</strong><div className="ticket-meta"><span>GA · FLOOR</span><span>GIWA / 0042</span></div><div className="ticket-dash" /><div className="ticket-status"><span><LockKeyhole size={16} /> WALLET BOUND</span><small>Return enabled</small></div></div><div className="floating-chip chip-one"><RotateCcw /> Return-to-Queue</div><div className="floating-chip chip-two"><ShieldCheck /> No private resale</div></div>
      </section>

      <section className="trust-marquee"><div><ShieldCheck /> Non-transferable ownership</div><div><RotateCcw /> Original-price reassignment</div><div><BadgeCheck /> Optional Dojang verification</div><div><LockKeyhole /> No identity documents stored</div></section>

      <section className="events-section" id="events"><div className="section-heading"><div><span className="eyebrow">LIVE ON TESTNET</span><h2>Events worth showing up for.</h2></div><div className="availability"><span>{availableCount}</span> events with open access {eventsLoading ? '· syncing' : onchainEvents.length ? `· ${onchainEvents.length} onchain` : ''}</div></div><div className="event-filter-tabs"><button className={eventFilter === 'all' ? 'active' : ''} onClick={() => setEventFilter('all')}>All events</button><button className={eventFilter === 'verified' ? 'active' : ''} onClick={() => setEventFilter('verified')}>Verified organizers</button><button className={eventFilter === 'unverified' ? 'active' : ''} onClick={() => setEventFilter('unverified')}>Unverified organizers</button></div><div className="events-grid">{filteredEvents.map((event) => <EventCard key={`${event.source ?? 'demo'}-${event.id}`} event={event} onSelect={setSelectedEvent} />)}</div></section>

      <section className="protocol-section" id="protocol"><div className="protocol-copy"><span className="eyebrow">THE RETURN-TO-QUEUE PROTOCOL</span><h2>A ticket can leave your wallet. It just can’t enter a reseller’s.</h2><p>When plans change, the holder returns the ticket to the event contract. The ticket is refunded, retired and offered to the next eligible fan at the same original price.</p><a href="#events">Try the live flow <ArrowRight size={17} /></a></div><div className="flow-card"><div className="flow-step active"><span>01</span><Ticket /><div><strong>Claim</strong><small>A wallet receives one active pass</small></div></div><div className="flow-line" /><div className="flow-step"><span>02</span><RotateCcw /><div><strong>Return</strong><small>The holder receives refundable credit</small></div></div><div className="flow-line" /><div className="flow-step"><span>03</span><CalendarDays /><div><strong>Reassign</strong><small>The next fan claims at face value</small></div></div></div></section>

      <MyPasses connected={Boolean(wallet.address)} passes={passes} loading={passesLoading} returningTicket={returningTicket} onConnect={() => void handleConnect()} onReturn={handleReturn} onCancellationRefund={handleCancellationRefund} />

      <section className="organizer-cta" id="organizers"><div><span className="eyebrow">FOR ORGANIZERS</span><h2>Fill the room, not the resale market.</h2><p>Create a fair-access event, upload its image, choose open or verified entry and keep every released seat inside the official queue.</p></div><button onClick={() => wallet.address ? setOrganizerOpen(true) : void handleConnect()}>Open organizer studio <ArrowRight /></button></section>
      <footer><Logo /><p>Privacy-preserving anti-scalping tickets on GIWA Sepolia.</p><span>Final testnet build · 2026</span></footer>

      {selectedEvent && <EventModal event={selectedEvent} account={wallet.address} onClose={() => setSelectedEvent(null)} onAction={handleTicketAction} onCancel={handleCancelEvent} loading={ticketActionLoading} />}
      {organizerOpen && wallet.address && <OrganizerStudio account={wallet.address} onClose={() => setOrganizerOpen(false)} onCreated={(message) => { setToast(message); void refreshAll(); }} />}
      {accountOpen && wallet.address && <AccountModal address={wallet.address} verified={wallet.verified} passCount={passes.length} refundCredits={refundCredits} withdrawing={withdrawing} isProtocolOwner={Boolean(protocolOwner && wallet.address.toLowerCase() === protocolOwner.toLowerCase())} approving={approvingOrganizer} adminNotice={organizerAdminNotice} onApproval={handleOrganizerApproval} onWithdraw={handleWithdraw} onDisconnect={disconnectLocally} onClose={() => setAccountOpen(false)} />}
      {toast && <button className="toast" onClick={() => setToast(null)}>{toast}<X size={16} /></button>}
    </main>
  );
}
