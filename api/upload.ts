import { put } from '@vercel/blob';

export const config = { maxDuration: 30 };

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return Response.json({ error: 'Method not allowed.' }, { status: 405 });
    }

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return Response.json(
        { error: 'BLOB_READ_WRITE_TOKEN is missing. Reconnect the Blob store and redeploy.' },
        { status: 503 },
      );
    }

    try {
      const url = new URL(request.url);
      const originalName = url.searchParams.get('filename') || 'event-image.jpg';
      const contentType = request.headers.get('content-type') || '';
      const contentLength = Number(request.headers.get('content-length') || '0');

      if (!contentType.startsWith('image/')) {
        return Response.json({ error: 'Only JPG, PNG or WebP images are allowed.' }, { status: 415 });
      }
      if (contentLength > 4 * 1024 * 1024) {
        return Response.json({ error: 'Image must be smaller than 4 MB on the live site.' }, { status: 413 });
      }
      if (!request.body) {
        return Response.json({ error: 'Image file is required.' }, { status: 400 });
      }

      const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, '-');
      const blob = await put(
        `returnstile/events/${crypto.randomUUID()}-${safeName}`,
        request.body,
        {
          access: 'public',
          addRandomSuffix: false,
          contentType,
          token: process.env.BLOB_READ_WRITE_TOKEN,
        },
      );

      return Response.json({ url: blob.url });
    } catch (error) {
      console.error('Returnstile image upload failed:', error);
      return Response.json(
        { error: error instanceof Error ? error.message : 'Image upload failed.' },
        { status: 500 },
      );
    }
  },
};
