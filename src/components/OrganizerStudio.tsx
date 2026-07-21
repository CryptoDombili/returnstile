import { useMemo, useRef, useState } from 'react';
import { ArrowRight, BadgeCheck, CalendarDays, ImagePlus, LoaderCircle, ShieldCheck, UploadCloud, X } from 'lucide-react';
import type { Address } from 'viem';
import { GIWA_EXPLORER_URL } from '../lib/giwa';
import { availablePaymentAssets, createReturnstileEvent, RETURNSTILE_ADDRESS, type PaymentAsset } from '../lib/returnstile';

type Props = { account: Address; onClose: () => void; onCreated: (message: string) => void; };

function localDateTime(hoursFromNow: number) {
  const date = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

async function compressImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const maxWidth = 1600;
  const maxHeight = 900;
  const scale = Math.min(maxWidth / bitmap.width, maxHeight / bitmap.height, 1);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Image processing is unavailable.');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', .82);
}

async function uploadImage(file: File): Promise<{ url: string; persisted: boolean }> {
  const form = new FormData();
  form.append('file', file);
  try {
    const response = await fetch('/api/upload', { method: 'POST', body: form });
    if (response.ok) {
      const result = await response.json() as { url?: string };
      if (result.url) return { url: result.url, persisted: true };
    }
  } catch {
    // Local development has no Vercel function. Fall back to a compressed browser image.
  }
  return { url: await compressImage(file), persisted: false };
}

export default function OrganizerStudio({ account, onClose, onCreated }: Props) {
  const defaults = useMemo(() => ({ startsAt: localDateTime(72), returnDeadline: localDateTime(48) }), []);
  const fileInput = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('GIWA Builders Night');
  const [venue, setVenue] = useState('Seoul');
  const [imageUrl, setImageUrl] = useState('');
  const [imageName, setImageName] = useState('');
  const [imagePersisted, setImagePersisted] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [startsAt, setStartsAt] = useState(defaults.startsAt);
  const [returnDeadline, setReturnDeadline] = useState(defaults.returnDeadline);
  const [capacity, setCapacity] = useState(100);
  const [price, setPrice] = useState('0');
  const [paymentAsset, setPaymentAsset] = useState<PaymentAsset>('ETH');
  const [claimWindowMinutes, setClaimWindowMinutes] = useState(30);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function chooseImage(file?: File) {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Choose an image file.'); return; }
    if (file.size > 8 * 1024 * 1024) { setError('Image must be smaller than 8 MB.'); return; }
    setUploading(true); setError(null);
    try {
      const result = await uploadImage(file);
      setImageUrl(result.url); setImageName(file.name); setImagePersisted(result.persisted);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Image upload failed.');
    } finally { setUploading(false); }
  }

  async function submit() {
    setLoading(true); setError(null);
    try {
      const { hash, eventId } = await createReturnstileEvent(account, { title, venue, imageUrl, startsAt, returnDeadline, capacity, price, paymentAsset, claimWindowMinutes, verifiedOnly });
      onCreated(`Event #${eventId} created on GIWA Sepolia · ${hash.slice(0, 10)}…`);
      onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Event creation failed.'); }
    finally { setLoading(false); }
  }

  return (
    <div className="studio-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="organizer-studio" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <div className="studio-head"><div><span className="eyebrow">ONCHAIN ORGANIZER STUDIO</span><h2>Create a fair-access event.</h2><p>Choose an image from your computer. Only a metadata fingerprint is stored onchain.</p></div><button className="studio-close" onClick={onClose} aria-label="Close"><X /></button></div>
        {!RETURNSTILE_ADDRESS && <div className="studio-error">Contract address is missing from the deployment environment.</div>}
        {error && <div className="studio-error">{error}</div>}
        <div className="studio-grid">
          <label>Event name<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          <label>Venue<input value={venue} onChange={(event) => setVenue(event.target.value)} /></label>
          <div className="studio-image-upload">
            <input ref={fileInput} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void chooseImage(event.target.files?.[0])} />
            <button type="button" className="image-upload-button" onClick={() => fileInput.current?.click()} disabled={uploading}>
              {uploading ? <LoaderCircle className="spin" /> : <UploadCloud />}<span><strong>{imageName || 'Upload event image'}</strong><small>JPG, PNG or WebP · max 8 MB</small></span>
            </button>
            <div className="image-upload-preview">{imageUrl ? <img src={imageUrl} alt="Event preview" /> : <ImagePlus />}</div>
            {imageUrl && <small className="image-upload-note">{imagePersisted ? 'Uploaded for public display.' : 'Local preview mode. Vercel Blob activates after deployment setup.'}</small>}
          </div>
          <label><CalendarDays size={16} /> Event starts<input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></label>
          <label><CalendarDays size={16} /> Return deadline<input type="datetime-local" value={returnDeadline} onChange={(event) => setReturnDeadline(event.target.value)} /></label>
          <label>Capacity<input type="number" min="1" value={capacity} onChange={(event) => setCapacity(Number(event.target.value))} /></label>
          <label>Payment asset<select value={paymentAsset} onChange={(event) => setPaymentAsset(event.target.value as PaymentAsset)}>{availablePaymentAssets().map((asset) => <option key={asset} value={asset}>{asset}</option>)}</select></label>
          <label>Ticket price ({paymentAsset})<input inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} /></label>
          <label>Queue claim window (minutes)<input type="number" min="5" value={claimWindowMinutes} onChange={(event) => setClaimWindowMinutes(Number(event.target.value))} /></label>
          <button type="button" className={`verification-mode ${verifiedOnly ? 'selected' : ''}`} onClick={() => setVerifiedOnly((value) => !value)}>{verifiedOnly ? <BadgeCheck /> : <ShieldCheck />}<span><strong>{verifiedOnly ? 'Verified event' : 'Open event'}</strong><small>{verifiedOnly ? 'Dojang verification required to claim.' : 'Any wallet may claim one active ticket.'}</small></span></button>
        </div>
        <div className="studio-foot"><a href={`${GIWA_EXPLORER_URL}/address/${RETURNSTILE_ADDRESS ?? ''}`} target="_blank" rel="noreferrer">View protocol contract</a><button className="studio-submit" onClick={submit} disabled={loading || uploading || !RETURNSTILE_ADDRESS || !title.trim()}>{loading ? <><LoaderCircle className="spin" /> Creating on GIWA…</> : <>Create event <ArrowRight /></>}</button></div>
      </section>
    </div>
  );
}
