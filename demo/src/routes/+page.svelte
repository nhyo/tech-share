<script lang="ts">
</script>

<svelte:head>
  <title>Cloud Photo Gallery</title>
</svelte:head>

<main>
  <p class="eyebrow">Vercel Blob Tech Share</p>
  <h1>My Cloud Gallery</h1>
  <p>Choose an image, then upload it to cloud storage.</p>

  <!-- TODO: Add Input -->

  <!-- TODO: Show selected File -->

  <!-- TODO: Add Upload Button -->

  <!-- TODO: Error Handling -->

  <!-- TODO: Add File Preview -->

  <!-- TODO: Add Gallery -->
    <!-- Gallery Loading Button -->
    <!-- Gallery list -->
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

  article img {
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
