<p align="right">
  <strong>English</strong> | <a href="./README.zh-CN.md">简体中文</a>
</p>

# Vercel Blob Cloud Photo Gallery Tech Share

This is a SvelteKit project for a classroom Tech Share. It demonstrates how to build a simple cloud photo gallery with Vercel Blob.

## Final Result

The completed page can:

1. Select a JPG, PNG, or WebP image;
2. Validate the image format and limit the file size to under 4 MB;
3. Upload the image to Vercel Blob with `put()`;
4. Display the image using the Public URL returned by Blob;
5. Load up to 30 images under the `tech-share/` path with `list()`;
6. Delete a selected image from cloud storage with `del()`.

## Repository Structure

```text
tech share/
├── demo/             Classroom starting point: complete frontend, empty backend file
├── finial/           Final version: complete frontend and backend
├── README.md         Default English documentation
└── README.zh-CN.md   Chinese documentation
```

- [`demo/`](demo/) is the original version copied at the beginning of class.
- [`finial/`](finial/) is the reference version after all stages are complete.
- `practice/` is the local working copy you create. It is ignored by `.gitignore`.

The frontends in `demo` and `finial` are identical. The difference is:

- [`demo/src/routes/api/blob/+server.ts`](demo/src/routes/api/blob/+server.ts) is a pre-created empty file;
- [`finial/src/routes/api/blob/+server.ts`](finial/src/routes/api/blob/+server.ts) contains the completed backend.

## From Demo to Finial

The classroom demo is divided into four stages:

| Stage | Backend Feature | Core API |
| --- | --- | --- |
| 1 | Receive and validate a file | `request.formData()` |
| 2 | Upload an image | `put()` |
| 3 | Read the image list | `list()` |
| 4 | Delete an image | `del()` |

Every stage modifies only this existing file:

```text
practice/src/routes/api/blob/+server.ts
```

You do not need to create any files or folders during class, and you do not need to modify the frontend.

## Stage 0: Pre-Class Setup

### 0.1 Create a Clean Practice Copy

Run the following commands from the repository root. Execute them one line at a time. Do not copy the terminal prompt `$`, and do not add `\` to the end of a line.

Deleting the old `practice` directory also deletes its `.env.local` file and your practice changes. Save any credentials you still need before continuing.

Git Bash:

```bash
rm -rf -- practice
cp -r demo practice
cd practice
npm install
cp .env.example .env.local
```

PowerShell:

```powershell
Remove-Item -Recurse -Force practice -ErrorAction SilentlyContinue
Copy-Item -Recurse demo practice
cd practice
npm install
Copy-Item .env.example .env.local
```

All later code changes go into `practice`, leaving the original `demo` unchanged.

### 0.2 Create and Connect a Vercel Blob Store

1. Create or select a Project in the Vercel Dashboard.
2. Open the Project's Storage page.
3. Create a Blob Store.
4. Select **Public** because the page places the Blob URL directly in an `<img>` element.
5. Connect the Blob Store to the Project.
6. Get the environment variables required for local development.

Open:

```text
practice/.env.local
```

Add your credential:

```env
BLOB_READ_WRITE_TOKEN=your_real_token_here
```

You can also use the Vercel CLI inside `practice`:

```bash
vercel link
vercel env pull .env.local
```

### 0.3 Start the Development Server

Run the following command inside `practice` (opening a new terminal in VS Code is recommended):

```bash
npm run dev
```

The initial page already includes:

- An image file picker;
- An Upload button;
- Upload status and image preview;
- A Load Gallery button;
- Gallery image cards;
- Delete buttons;
- All frontend requests and page styles.

The backend file is still empty at this point, so the buttons cannot complete their cloud operations yet.

## Stage 1: Receive and Validate a File

### Where to Paste

Open this empty file:

```text
practice/src/routes/api/blob/+server.ts
```

Starting from the first line, paste the complete code below:

```ts
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
  const form = await request.formData();
  const file = form.get('file');

  if (
    !(file instanceof File) ||
    !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
    file.size > 4 * 1024 * 1024
  ) {
    return Response.json(
      { error: 'Choose a JPG, PNG or WebP image under 4 MB' },
      { status: 400 }
    );
  }

  return Response.json({
    message: `Received ${file.name} (${file.size} bytes)`
  });
};
```

### What This Code Does

- Creates a POST backend endpoint;
- Uses `request.formData()` to get the file submitted by the frontend;
- Accepts only JPG, PNG, and WebP images;
- Limits the file size to under 4 MB;
- Temporarily returns the file name and size to prove that the server received the file.

### Verify

Save the file, select an image, and click Upload.

The page should display something similar to:

```text
Received photo.jpg (123456 bytes)
```

At this point, the image has reached the SvelteKit backend but has not been uploaded to Vercel Blob.

## Stage 2: Upload to Vercel Blob

Continue editing:

```text
practice/src/routes/api/blob/+server.ts
```

### 2.1 Paste Two Imports

Find the first line:

```ts
import type { RequestHandler } from './$types';
```

Immediately below it, paste:

```ts
import { put } from '@vercel/blob';
import { BLOB_READ_WRITE_TOKEN } from '$app/env/private';
```

These imports provide:

- `put()`, which uploads a file to Vercel Blob;
- `BLOB_READ_WRITE_TOKEN`, the server's private credential for accessing the Blob Store.

### 2.2 Replace the Temporary Response from Stage 1

Find this code at the end of the POST endpoint:

```ts
return Response.json({
  message: `Received ${file.name} (${file.size} bytes)`
});
```

Delete it, then paste the following code in the same location:

```ts
const blob = await put(`tech-share/${file.name}`, file, {
  access: 'public',
  addRandomSuffix: true,
  token: BLOB_READ_WRITE_TOKEN
});

return Response.json({
  url: blob.url,
  pathname: blob.pathname
});
```

### What This Code Does

- Uploads the file with `put()`;
- Places the image under the `tech-share/` path;
- Sets `access: 'public'` so the browser can display the image directly;
- Adds a random suffix so files with the same name receive different pathnames, preventing upload conflicts;
- Returns the Blob `url` and `pathname` to the frontend.

### Verify

Save the file, select an image again, and click Upload.

The page should show Upload successful, a link to the file, and an image preview. The image is now stored in Vercel Blob rather than in the local project.

## Stage 3: Read the Image List

Continue editing:

```text
practice/src/routes/api/blob/+server.ts
```

### 3.1 Update the Blob SDK Import

Find:

```ts
import { put } from '@vercel/blob';
```

Replace it with:

```ts
import { list, put } from '@vercel/blob';
```

This imports `list()` for reading the Blob list while keeping the existing `put()` import.

### 3.2 Add a GET Endpoint at the End of the File

Scroll to the bottom of `+server.ts`. After the `};` that closes the POST endpoint, start a new line and paste:

```ts
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
```

### What This Code Does

- Creates a GET backend endpoint;
- Uses `list()` to read files under the `tech-share/` path;
- Reads up to 30 Blobs;
- Returns only the `url` and `pathname` needed by the frontend.

### Verify

Save the file and click Load Gallery. The page should display the images you uploaded. Refresh the page and click the button again; the images should still be there.

## Stage 4: Delete an Image

Continue editing:

```text
practice/src/routes/api/blob/+server.ts
```

### 4.1 Update the Blob SDK Import

Find:

```ts
import { list, put } from '@vercel/blob';
```

Replace it with:

```ts
import { del, list, put } from '@vercel/blob';
```

This adds the `del()` function needed to delete a Blob.

### 4.2 Add a DELETE Endpoint at the End of the File

Scroll to the bottom of `+server.ts`. After the `};` that closes the GET endpoint, start a new line and paste:

```ts
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
```

### What This Code Does

- Creates a DELETE backend endpoint;
- Reads the `pathname` to delete from the frontend request;
- Ensures that only files under the `tech-share/` path can be deleted;
- Deletes the matching Blob with `del()`;
- Returns a successful result.

### Verify

Save the file, click Load Gallery, and then click Delete on any image card. The frontend automatically reloads the Gallery, and the deleted image should disappear.

## Completed Backend Structure

After completing Stages 1–4, `practice/src/routes/api/blob/+server.ts` should contain the following sections in order:

```text
Import RequestHandler, put, list, del, and the private token
│
├── POST    Receive and upload an image
├── GET     Read the image list
└── DELETE  Delete a selected image
```

If something goes wrong, compare your code with the completed reference file:

[`finial/src/routes/api/blob/+server.ts`](finial/src/routes/api/blob/+server.ts)

## Security Notes

- `.env.local` is ignored by Git;
- Never put a real `BLOB_READ_WRITE_TOKEN` in source code, a README, screenshots, or Git commits;
- The repository's `.env.example` files contain only credential placeholders;
- This classroom demo has no authentication, user authorization, or rate limiting and should not be used directly as a public production upload API.

## Citations
1. "Vercel Blob Documentation." https://vercel.com/docs/vercel-blob ^1
2. Ben Sabic. (2026). "The Complete Guide to Vercel Blob."  https://vercel.com/kb/guide/vercel-blob ^2
3. "Vercel Blob About Page." https://vercel.com/storage/blob ^3
4. "Vercel Blob SvelteKit Starter." https://vercel.com/templates/svelte/blob-sveltekit ^4
5. "Basic SvelteKit/API routes/Get handlers". https://svelte.dev/tutorial/kit/get-handlers ^5
