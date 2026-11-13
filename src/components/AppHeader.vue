<script setup>
defineOptions({ name: 'AppHeader' })
</script>

<template>
  <header class="app-header">
    <div class="app-header__inner">
      <div class="brand">
        <span class="brand__mark" aria-hidden="true">N</span>
        <span class="brand__text">
          <span class="brand__name">Nurjan</span>
          <span class="brand__tagline">轻量信息流</span>
        </span>
      </div>
      <span class="local-pill" title="所有内容仅保存在当前浏览器中">
        <span class="local-pill__dot" aria-hidden="true"></span>
        仅存储在本机
      </span>
    </div>
  </header>
</template>
