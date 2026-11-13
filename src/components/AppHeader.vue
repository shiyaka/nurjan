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
      <span class="local-pill" title="数据保存在服务端内存中，服务重启后会清空">
        <span class="local-pill__dot" aria-hidden="true"></span>
        内存存储
      </span>
    </div>
  </header>
</template>
