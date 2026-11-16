<script lang="ts">
  import { upload } from '@vercel/blob/client';

  type GalleryImage = {
    url: string;
    pathname: string;
  };

  let selectedFile = $state<File | null>(null);
  let imageUrl = $state('');
  let error = $state('');
  let message = $state('');
  let images = $state<GalleryImage[]>([]);
  let uploading = $state(false);

  async function uploadImage() {
    if (!selectedFile) return;

    error = '';
    message = '';
    imageUrl = '';
    uploading = true;

    try {
      const blob = await upload(`tech-share/${selectedFile.name}`, selectedFile, {
        access: 'public',
        handleUploadUrl: '/api/blob',
        multipart: selectedFile.size > 100 * 1024 * 1024
      });
      
      imageUrl = blob.url;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Upload failed';
    } finally {
      uploading = false;
    }
  }

  async function loadImages() {
    error = '';
    const response = await fetch('/api/blob');

    if (!response.ok) {
      error = 'Failed to load images';
      return;
    }

    images = await response.json();
  }

  async function deleteImage(pathname: string) {
    error = '';
    const response = await fetch('/api/blob', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ pathname })
    });

    if (!response.ok) {
      error = 'Failed to delete image';
      return;
    }

    await loadImages();
  }
</script>

<svelte:head>
  <title>Cloud Photo Gallery</title>
</svelte:head>

<main>
  <p class="eyebrow">Vercel Blob Tech Share</p>
  <h1>My Cloud Gallery</h1>
  <p>Choose an image, then upload it to cloud storage.</p>

  <input
    type="file"
    accept="image/jpeg,image/png,image/webp,video/mp4"
    onchange={(event) =>
      selectedFile = event.currentTarget.files?.[0] ?? null
    }
  />

  {#if selectedFile}
    <p class="selected">Selected: {selectedFile.name}</p>
  {/if}

  <button onclick={uploadImage} disabled={!selectedFile}>
    Upload
  </button>

  {#if error}
    <p class="error">{error}</p>
  {/if}

  {#if message}
    <p class="message">{message}</p>
  {/if}

  {#if imageUrl}
    <p class="success">Upload successful!</p>
    <a href={imageUrl} target="_blank" rel="noreferrer">
      Open uploaded file
    </a>

    {#if imageUrl.toLowerCase().endsWith('.mp4')}
      <video src={item.url} controls preload="metadata">
        <track kind="captions" />
      </video>
    {:else}
      <img class="preview" src={imageUrl} alt="Uploaded preview" />
    {/if}
  {/if}

  <section>
    <div class="section-heading">
      <div>
        <p class="eyebrow">Persistent storage</p>
        <h2>My Gallery</h2>
      </div>
      <button onclick={loadImages}>Load Gallery</button>
    </div>

    <div class="gallery">
      {#each images as item (item.pathname)}
        <article>
          {#if item.pathname.toLowerCase().endsWith('.mp4')}
            <video src={item.url} controls preload="metadata">
              <track kind="captions" />
            </video>
          {:else}
            <img src={item.url} alt={item.pathname} />
          {/if}

          <p class="pathname">{item.pathname}</p>
          <button onclick={() => deleteImage(item.pathname)}>
            Delete
          </button>
        </article>
      {/each}
    </div>
  </section>
</main>

<style>
  :global(body) {
    margin: 0;
    font-family: system-ui, sans-serif;
    background: #f5f7fb;
    color: #172033;
  }

  main {
    width: min(760px, calc(100% - 40px));
    margin: 64px auto;
    padding: 32px;
    border-radius: 18px;
    background: white;
    box-shadow: 0 16px 45px rgb(23 32 51 / 10%);
  }

  .eyebrow {
    color: #5b5bd6;
    font-weight: 700;
  }

  input {
    display: block;
    margin: 24px 0 12px;
  }

  button {
    margin-top: 12px;
    padding: 10px 18px;
    border: 0;
    border-radius: 9px;
    background: #5b5bd6;
    color: white;
    font-weight: 700;
    cursor: pointer;
  }

  button:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  .selected,
  .pathname {
    color: #596273;
  }

  .error {
    color: #b42318;
  }

  .message {
    color: #175cd3;
  }

  .success {
    color: #067647;
    font-weight: 700;
  }

  .preview {
    display: block;
    width: min(100%, 420px);
    margin-top: 16px;
    border-radius: 12px;
  }

  section {
    margin-top: 48px;
    padding-top: 28px;
    border-top: 1px solid #e5e7eb;
  }

  .section-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
  }

  .section-heading h2,
  .section-heading p {
    margin: 0;
  }

  .gallery {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 16px;
    margin-top: 24px;
  }

  article {
    min-width: 0;
    padding: 12px;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
  }

  article img,
  article video {
    width: 100%;
    aspect-ratio: 4 / 3;
    border-radius: 8px;
    object-fit: cover;
  }

  .pathname {
    overflow: hidden;
    font-size: 0.8rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
