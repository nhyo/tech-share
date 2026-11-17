'use strict';

const PAGE = 'src/routes/+page.svelte';
const SERVER = 'src/routes/api/blob/+server.ts';

const chapters = [
  {
    id: 'select',
    title: 'Stage 1 · Select a file',
    objective: 'Add only the state and HTML needed to select a file.',
    operations: [
      {
        file: PAGE,
        kind: 'replace',
        label: 'define selectedFile state',
        find: `<script lang="ts">\n</script>`,
        text: `<script lang="ts">\n  let selectedFile = $state<File | null>(null);\n</script>`
      },
      {
        file: PAGE,
        kind: 'insertBefore',
        label: 'define error state',
        find: `</script>`,
        text: `  let error = $state('');\n`
      },
      {
        file: PAGE,
        kind: 'replace',
        label: 'create the file input',
        find: `  <!-- TODO: Add Input -->`,
        text: `  <input\n    type="file"\n    accept="image/jpeg,image/png,image/webp,video/mp4"\n    onchange={(event) =>\n      selectedFile = event.currentTarget.files?.[0] ?? null\n    }\n  />`
      },
      {
        file: PAGE,
        kind: 'replace',
        label: 'show the selected filename',
        find: `  <!-- TODO: Show selected File -->`,
        text: `  {#if selectedFile}\n    <p class="selected">Selected: {selectedFile.name}</p>\n  {/if}`
      }
    ]
  },
  {
    id: 'upload',
    title: 'Stage 2 · Upload with Vercel Blob',
    objective: 'Add the minimal client upload flow and its secure token endpoint.',
    operations: [
      {
        file: SERVER,
        kind: 'replace',
        label: 'add POST endpoint imports',
        find: `// TODO: Type Import lists.`,
        text: `import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';\nimport type { RequestHandler } from './$types';\nimport { BLOB_READ_WRITE_TOKEN } from '$app/env/private';`
      },
      {
        file: SERVER,
        kind: 'replace',
        label: 'define the POST upload endpoint',
        find: `// STEP 1: Create POST\n  // TODO: Add constraints\n  // TODO: Put the file into Vercel blob using token.\n  // TODO: Return JSON Response with url and pathname.`,
        text: `export const POST: RequestHandler = async ({ request }) => {\n  const body = (await request.json()) as HandleUploadBody;\n\n  try {\n    const jsonResponse = await handleUpload({\n      body,\n      request,\n      token: BLOB_READ_WRITE_TOKEN,\n      onBeforeGenerateToken: async (pathname) => {\n        if (!pathname.startsWith('tech-share/')) {\n          throw new Error('Invalid upload path');\n        }\n\n        return {\n          allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp', 'video/mp4'],\n          maximumSizeInBytes: 500 * 1024 * 1024,\n          addRandomSuffix: true\n        };\n      }\n    });\n\n    return Response.json(jsonResponse);\n  } catch (error) {\n    return Response.json(\n      { error: error instanceof Error ? error.message : 'Upload failed' },\n      { status: 400 }\n    );\n  }\n};`
      },
      {
        file: PAGE,
        kind: 'insertAfter',
        label: 'import the browser upload helper',
        find: `<script lang="ts">`,
        text: `\n  import { upload } from '@vercel/blob/client';`
      },
      {
        file: PAGE,
        kind: 'insertBefore',
        label: 'define imageUrl state',
        find: `  let error = $state('');`,
        text: `  let imageUrl = $state('');\n`
      },
      {
        file: PAGE,
        kind: 'insertBefore',
        label: 'define uploadImage function',
        find: `</script>`,
        text: `\n  async function uploadImage() {\n    if (!selectedFile) return;\n\n    error = '';\n    imageUrl = '';\n\n    try {\n      const blob = await upload(\`tech-share/\${selectedFile.name}\`, selectedFile, {\n        access: 'public',\n        handleUploadUrl: '/api/blob',\n        multipart: selectedFile.size > 100 * 1024 * 1024\n      });\n      \n      imageUrl = blob.url;\n    } catch (err) {\n      error = err instanceof Error ? err.message : 'Upload failed';\n    }\n  }\n`
      },
      {
        file: PAGE,
        kind: 'replace',
        label: 'create the Upload button',
        find: `  <!-- TODO: Add Upload Button -->`,
        text: `  <button onclick={uploadImage} disabled={!selectedFile}>\n    Upload\n  </button>`
      },
      {
        file: PAGE,
        kind: 'replace',
        label: 'create the error message block',
        find: `  <!-- TODO: Error Handling -->`,
        text: `  {#if error}\n    <p class="error">{error}</p>\n  {/if}`
      },
      {
        file: PAGE,
        kind: 'replace',
        label: 'remove the unused message style',
        find: `  .message {\n    color: #175cd3;\n  }\n\n`,
        text: ``
      },
      {
        file: PAGE,
        kind: 'replace',
        label: 'create the upload preview block',
        find: `  <!-- TODO: Add File Preview -->`,
        text: `  {#if imageUrl}\n    <p class="success">Upload successful!</p>\n    <a href={imageUrl} target="_blank" rel="noreferrer">\n      Open uploaded file\n    </a>\n\n    {#if imageUrl.toLowerCase().endsWith('.mp4')}\n      <video src={imageUrl} controls preload="metadata">\n        <track kind="captions" />\n      </video>\n    {:else}\n      <img class="preview" src={imageUrl} alt="Uploaded preview" />\n    {/if}\n  {/if}`
      }
    ]
  },
  {
    id: 'list',
    title: 'Stage 3 · Load the cloud gallery',
    objective: 'Add gallery state, one loading function, one endpoint, and the gallery HTML.',
    operations: [
      {
        file: PAGE,
        kind: 'insertBefore',
        label: 'define GalleryImage type',
        find: `  let selectedFile = $state<File | null>(null);`,
        text: `\n  type GalleryImage = {\n    url: string;\n    pathname: string;\n  };\n\n`
      },
      {
        file: PAGE,
        kind: 'insertAfter',
        label: 'define images state',
        find: `  let error = $state('');`,
        text: `\n  let images = $state<GalleryImage[]>([]);`
      },
      {
        file: PAGE,
        kind: 'insertBefore',
        label: 'define loadImages function',
        find: `</script>`,
        text: `\n  async function loadImages() {\n    error = '';\n    const response = await fetch('/api/blob');\n\n    if (!response.ok) {\n      error = 'Failed to load images';\n      return;\n    }\n\n    images = await response.json();\n  }\n`
      },
      {
        file: SERVER,
        kind: 'insertBefore',
        label: 'import list from Vercel Blob',
        find: `import { BLOB_READ_WRITE_TOKEN } from '$app/env/private';`,
        text: `import { list } from '@vercel/blob';\n`
      },
      {
        file: SERVER,
        kind: 'replace',
        label: 'define the GET gallery endpoint',
        find: `// STEP 2: Create GET\n  // TODO: Get a list from Vercel Blob.\n  // TODO: Return JSON map response with url and pathname.`,
        text: `export const GET: RequestHandler = async () => {\n  const { blobs } = await list({\n    prefix: 'tech-share/',\n    limit: 30,\n    token: BLOB_READ_WRITE_TOKEN\n  });\n\n  return Response.json(\n    blobs.map(({ url, pathname }) => ({\n      url,\n      pathname\n    }))\n  );\n};`
      },
      {
        file: PAGE,
        kind: 'replace',
        label: 'create the gallery HTML',
        find: `  <!-- TODO: Add Gallery -->\n    <!-- Gallery Loading Button -->\n    <!-- Gallery list -->`,
        text: `  <section>\n    <div class="section-heading">\n      <div>\n        <p class="eyebrow">Persistent storage</p>\n        <h2>My Gallery</h2>\n      </div>\n      <button onclick={loadImages}>Load Gallery</button>\n    </div>\n\n    <div class="gallery">\n      {#each images as item (item.pathname)}\n        <article>\n          {#if item.pathname.toLowerCase().endsWith('.mp4')}\n            <video src={item.url} controls preload="metadata">\n              <track kind="captions" />\n            </video>\n          {:else}\n            <img src={item.url} alt={item.pathname} />\n          {/if}\n\n          <p class="pathname">{item.pathname}</p>\n        </article>\n      {/each}\n    </div>\n  </section>`
      },
      {
        file: PAGE,
        kind: 'replace',
        label: 'extend gallery media styling to video',
        find: `  article img {`,
        text: `  article img,\n  article video {`
      }
    ]
  },
  {
    id: 'delete',
    title: 'Stage 4 · Delete a selected Blob',
    objective: 'Add one delete function, one endpoint, and one button.',
    operations: [
      {
        file: SERVER,
        kind: 'replace',
        label: 'import del from Vercel Blob',
        find: `import { list } from '@vercel/blob';`,
        text: `import { del, list } from '@vercel/blob';`
      },
      {
        file: PAGE,
        kind: 'insertBefore',
        label: 'define deleteImage function',
        find: `</script>`,
        text: `\n  async function deleteImage(pathname: string) {\n    error = '';\n    const response = await fetch('/api/blob', {\n      method: 'DELETE',\n      headers: {\n        'Content-Type': 'application/json'\n      },\n      body: JSON.stringify({ pathname })\n    });\n\n    if (!response.ok) {\n      error = 'Failed to delete image';\n      return;\n    }\n\n    await loadImages();\n  }\n`
      },
      {
        file: SERVER,
        kind: 'replace',
        label: 'define the DELETE endpoint',
        find: `// STEP 3: Create DELETE \n  // TODO: Get a pathname to be deleted.\n  // TODO: Add constraints.\n  // TODO: Run del function.\n  // TODO: Return success response.`,
        text: `export const DELETE: RequestHandler = async ({ request }) => {\n  const { pathname } = await request.json();\n\n  if (\n    typeof pathname !== 'string' ||\n    !pathname.startsWith('tech-share/')\n  ) {\n    return Response.json(\n      { error: 'Invalid pathname' },\n      { status: 400 }\n    );\n  }\n\n  await del(pathname, {\n    token: BLOB_READ_WRITE_TOKEN\n  });\n\n  return Response.json({ success: true });\n};`
      },
      {
        file: PAGE,
        kind: 'insertAfter',
        label: 'create each gallery Delete button',
        find: `          <p class="pathname">{item.pathname}</p>`,
        text: `\n          <button onclick={() => deleteImage(item.pathname)}>\n            Delete\n          </button>`
      }
    ]
  }
];

const stages = chapters.flatMap((chapter, chapterIndex) =>
  chapter.operations.map((operation, operationIndex) => ({
    id: `${chapter.id}-${operationIndex + 1}`,
    chapterId: chapter.id,
    chapterNumber: chapterIndex + 1,
    stepNumber: operationIndex + 1,
    stepsInChapter: chapter.operations.length,
    title: `Stage ${chapterIndex + 1} · Step ${operationIndex + 1}/${chapter.operations.length} · ${operation.label}`,
    objective: operation.label,
    operations: [operation]
  }))
);

module.exports = { PAGE, SERVER, chapters, stages };
