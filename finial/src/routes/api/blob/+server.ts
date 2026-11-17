import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import type { RequestHandler } from './$types';
import { del, list } from '@vercel/blob';
import { BLOB_READ_WRITE_TOKEN } from '$app/env/private';

export const POST: RequestHandler = async ({ request }) => {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      token: BLOB_READ_WRITE_TOKEN,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith('tech-share/')) {
          throw new Error('Invalid upload path');
        }

        return {
          allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp', 'video/mp4'],
          maximumSizeInBytes: 500 * 1024 * 1024,
          addRandomSuffix: true
        };
      }
    });

    return Response.json(jsonResponse);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 400 }
    );
  }
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
