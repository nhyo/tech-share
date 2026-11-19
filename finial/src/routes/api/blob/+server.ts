import type { RequestHandler } from './$types';
import { del, list } from '@vercel/blob';
import { BLOB_READ_WRITE_TOKEN } from '$app/env/private';

export const POST: RequestHandler = async ({ request }) => {
  const form = await request.formData();
  const file = form.get('file');

  const blob = await put(`tech-share/${file.name}`, file, {
    access: 'public',
    addRandomSuffix: true,
    token: BLOB_READ_WRITE_TOKEN
  });

  return Response.json({
    url: blob.url,
    pathname: blob.pathname
  });
};

export const GET: RequestHandler = async () => {
  const { blobs } = await list({
    prefix: 'tech-share/',
    limit: 30,
    token: BLOB_READ_WRITE_TOKEN
  });

  return Response.json(
    blobs.map(({ url, pathname }) => ({
      url,
      pathname
    }))
  );
};

export const DELETE: RequestHandler = async ({ request }) => {
  const { pathname } = await request.json();

  if (
    typeof pathname !== 'string' ||
    !pathname.startsWith('tech-share/')
  ) {
    return Response.json(
      { error: 'Invalid pathname' },
      { status: 400 }
    );
  }

  await del(pathname, {
    token: BLOB_READ_WRITE_TOKEN
  });

  return Response.json({ success: true });
};
