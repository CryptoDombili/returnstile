import { useState } from 'react';
import { BadgeCheck, Copy, ExternalLink, LogOut, RotateCcw, ShieldCheck, UserCheck, Wallet, X } from 'lucide-react';
import { isAddress, type Address } from 'viem';
import { GIWA_EXPLORER_URL } from '../lib/giwa';
import type { RefundBalance } from '../lib/returnstile';

type Props = {
  address: Address; verified: boolean | null; passCount: number; refundCredits: RefundBalance[]; withdrawing: boolean;
  isProtocolOwner: boolean; approving: boolean; adminNotice: string | null;
  onApproval: (organizer: Address, approved: boolean) => void | Promise<void>;
  onWithdraw: (token: Address) => void | Promise<void>;
  onDisconnect: () => void; onClose: () => void;
};

export default function AccountModal({ address, verified, passCount, refundCredits, withdrawing, isProtocolOwner, approving, adminNotice, onApproval, onWithdraw, onDisconnect, onClose }: Props) {
  const [organizer, setOrganizer] = useState<string>(address);
  const validOrganizer = isAddress(organizer);
  const refundable = refundCredits.filter((item) => item.amount > 0n);
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="account-modal" onMouseDown={(event) => event.stopPropagation()}>
    <button className="modal-close" onClick={onClose}><X /></button>
    <span className="eyebrow">MY ACCOUNT</span><h2>Wallet connected.</h2>
    <div className="account-address"><Wallet /><code>{address}</code><button onClick={() => void navigator.clipboard.writeText(address)}><Copy /></button></div>
    <div className="account-stats">
      <div><TicketIcon /><strong>{passCount}</strong><span>active passes</span></div>
      <div><RotateCcw /><strong>{refundable.length}</strong><span>refundable assets</span></div>
      <div>{verified ? <BadgeCheck /> : <ShieldCheck />}<strong>{verified ? 'Dojang verified' : verified === false ? 'Open access' : 'Unknown'}</strong><span>wallet status</span></div>
    </div>
    {refundable.length > 0 && <div className="refund-assets"><strong>Refund balances</strong>{refundable.map((item) => <button key={item.asset} disabled={withdrawing} onClick={() => void onWithdraw(item.token)}><span>{item.formatted} {item.asset}</span><small>{withdrawing ? 'Processing…' : 'Withdraw'}</small></button>)}</div>}
    {isProtocolOwner && <div className="admin-verify-panel">
      <div><UserCheck /><span><strong>Returnstile admin</strong><small>Green verification requires both admin approval and Dojang verification.</small></span></div>
      <label className="admin-target-label">Organizer wallet</label>
      <div className="admin-target-row"><input value={organizer} onChange={(event) => setOrganizer(event.target.value.trim())} placeholder="0x organizer wallet" /><button type="button" onClick={() => setOrganizer(address)}>Use mine</button></div>
      {!validOrganizer && organizer.length > 0 && <p className="admin-input-error">Enter a complete 0x wallet address.</p>}
      <div className="admin-verify-actions"><button disabled={!validOrganizer || approving} onClick={() => void onApproval(organizer as Address, true)}>{approving ? 'Confirming…' : 'Approve onchain'}</button><button className="danger" disabled={!validOrganizer || approving} onClick={() => void onApproval(organizer as Address, false)}>{approving ? 'Confirming…' : 'Revoke onchain'}</button></div>
      {adminNotice && <p className="admin-verify-notice">{adminNotice}</p>}
    </div>}
    <div className="account-actions"><a href={`${GIWA_EXPLORER_URL}/address/${address}`} target="_blank" rel="noreferrer">View on explorer <ExternalLink /></a><button className="danger" onClick={onDisconnect}>Disconnect locally <LogOut /></button></div>
  </section></div>;
}
function TicketIcon(){ return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a3 3 0 0 0 0 6v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a3 3 0 0 0 0-6V7Z" fill="none" stroke="currentColor" strokeWidth="2"/></svg> }
