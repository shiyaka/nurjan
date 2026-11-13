<script setup>
import { onBeforeUnmount, onMounted } from 'vue'
import AppHeader from '@/components/AppHeader.vue'
import PostComposer from '@/components/PostComposer.vue'
import PostList from '@/components/PostList.vue'
import EmptyState from '@/components/EmptyState.vue'
import ToastHost from '@/components/ToastHost.vue'
import { usePostsStore } from '@/stores/posts'
import { useToast } from '@/composables/useToast'
import { STORAGE_KEY } from '@/constants'

defineOptions({ name: 'App' })

const store = usePostsStore()
const { message, visible, show } = useToast()

store.hydrate()

function handleSubmit(content) {
  const result = store.add(content)

  if (!result.ok) {
    show(result.reason === 'quota' ? '保存失败：本地存储空间可能已满' : '发布失败，请稍后重试')
    return
  }

  show('已发布，仅保存在本机')
}

function handleRemove(id) {
  const result = store.remove(id)
  show(result.ok ? '已删除' : '删除失败，请稍后重试')
}

function handleStorage(event) {
  if (event.key === STORAGE_KEY) {
    store.hydrate()
  }
}

onMounted(() => {
  window.addEventListener('storage', handleStorage)
})

onBeforeUnmount(() => {
  window.removeEventListener('storage', handleStorage)
})
</script>

<template>
  <div class="ambient ambient--one" aria-hidden="true"></div>
  <div class="ambient ambient--two" aria-hidden="true"></div>

  <AppHeader />

  <main class="shell">
    <PostComposer @submit="handleSubmit" />

    <section class="timeline" aria-labelledby="timeline-title">
      <div class="timeline__head">
        <h2 id="timeline-title" class="timeline__title">时间线</h2>
        <span v-if="store.count > 0" id="post-count" class="chip">{{ store.count }} 条</span>
      </div>

      <PostList :posts="store.sorted" @remove="handleRemove" />

      <EmptyState v-if="store.count === 0" />
    </section>
  </main>

  <footer class="app-footer">
    <p>数据保存在当前浏览器的 Local Storage 中，清除站点数据即会一并移除。</p>
  </footer>

  <ToastHost :message="message" :visible="visible" />
</template>
