<script setup>
defineOptions({ name: 'EmptyState' })
</script>

<template>
  <div class="empty-state">
    <div class="empty-state__icon" aria-hidden="true">
      <svg viewBox="0 0 48 48" width="30" height="30" focusable="false">
        <path
          d="M14 34h20M17 26h14M20 18h8"
          fill="none"
          stroke="currentColor"
          stroke-width="2.4"
          stroke-linecap="round"
        />
        <circle
          cx="24"
          cy="24"
          r="17"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-dasharray="4 5"
          stroke-linecap="round"
        />
      </svg>
    </div>
    <p class="empty-state__title">这里还很安静</p>
    <p class="empty-state__hint">在上方写下第一条内容，它只会留在你的浏览器里。</p>
  </div>
</template>
