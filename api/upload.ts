import { put } from '@vercel/blob';

export const config = { runtime: 'nodejs' };

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  try {
    const data = await request.formData();
    const file = data.get('file');
    if (!(file instanceof File)) return new Response('Image file is required.', { status: 400 });
    if (!file.type.startsWith('image/')) return new Response('Only images are allowed.', { status: 415 });
    if (file.size > 8 * 1024 * 1024) return new Response('Image is too large.', { status: 413 });
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
    const blob = await put(`returnstile/events/${crypto.randomUUID()}-${safeName}`, file, { access: 'public', addRandomSuffix: false });
    return Response.json({ url: blob.url });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Upload failed.' }, { status: 500 });
  }
}
