<script setup>
import { computed, onMounted, ref } from 'vue'
import AppHeader from '@/components/AppHeader.vue'
import PostComposer from '@/components/PostComposer.vue'
import PostList from '@/components/PostList.vue'
import EmptyState from '@/components/EmptyState.vue'
import ToastHost from '@/components/ToastHost.vue'
import { usePostsStore } from '@/stores/posts'
import { isBrowserStorage } from '@/api/posts'
import { useToast } from '@/composables/useToast'

defineOptions({ name: 'App' })

const FAILURE_MESSAGE = '操作失败，请检查服务是否可用'
const STORAGE_NOTE = isBrowserStorage
  ? '纯静态演示：数据保存在当前浏览器本地，刷新不丢失，不同设备之间不共享。'
  : '数据保存在服务端内存中，服务重启后会清空。'

const store = usePostsStore()
const { message, visible, show } = useToast()

const showLoading = computed(() => store.loading || (!store.hydrated && !store.error))

const filter = ref('all')
const visiblePosts = computed(() =>
  filter.value === 'favorites'
    ? store.sorted.filter((post) => post.favorited === true)
    : store.sorted
)
const visibleCount = computed(() => visiblePosts.value.length)
const showFavoritesEmpty = computed(
  () => filter.value === 'favorites' && store.hydrated && visibleCount.value === 0
)

onMounted(() => {
  store.hydrate()
})

async function handleSubmit(content) {
  const result = await store.add(content)

  if (!result.ok) {
    if (result.reason === 'empty') {
      return
    }
    show(result.reason === 'too-long' ? '内容超出长度限制' : FAILURE_MESSAGE)
    return
  }

  show('已发布')
}

async function handleRemove(id) {
  const result = await store.remove(id)
  show(result.ok ? '已删除' : FAILURE_MESSAGE)
}

async function handleLike(id) {
  const result = await store.toggleLike(id)
  if (!result.ok && result.reason !== 'pending') {
    show(FAILURE_MESSAGE)
  }
}

async function handleFavorite(id) {
  const result = await store.toggleFavorite(id)
  if (!result.ok && result.reason !== 'pending') {
    show(FAILURE_MESSAGE)
  }
}
</script>

<template>
  <div class="ambient ambient--one" aria-hidden="true"></div>
  <div class="ambient ambient--two" aria-hidden="true"></div>

  <AppHeader />

  <main class="shell">
    <PostComposer :submitting="store.submitting" @submit="handleSubmit" />

    <section class="timeline" aria-labelledby="timeline-title">
      <div class="timeline__head">
        <h2 id="timeline-title" class="timeline__title">时间线</h2>
        <div class="timeline__filters" role="group" aria-label="筛选内容">
          <button
            class="timeline__filter"
            :class="{ 'is-active': filter === 'all' }"
            data-filter="all"
            type="button"
            :aria-pressed="filter === 'all' ? 'true' : 'false'"
            @click="filter = 'all'"
          >
            全部
          </button>
          <button
            class="timeline__filter"
            :class="{ 'is-active': filter === 'favorites' }"
            data-filter="favorites"
            type="button"
            :aria-pressed="filter === 'favorites' ? 'true' : 'false'"
            @click="filter = 'favorites'"
          >
            收藏
          </button>
        </div>
        <span v-if="visibleCount > 0" id="post-count" class="chip">{{ visibleCount }} 条</span>
      </div>

      <PostList
        :posts="visiblePosts"
        :is-pending="store.isPending"
        @remove="handleRemove"
        @like="handleLike"
        @favorite="handleFavorite"
      />

      <p v-if="showLoading" class="feed-loading" role="status">正在加载…</p>
      <div v-else-if="store.error && !store.hydrated" class="feed-error" role="alert">
        <p>加载失败，请检查服务是否可用。</p>
        <button type="button" @click="store.hydrate()">重试</button>
      </div>
      <EmptyState v-else-if="store.hydrated && store.count === 0" />
      <p v-else-if="showFavoritesEmpty" class="feed-empty">还没有收藏的内容</p>
    </section>
  </main>

  <footer class="app-footer">
    <p>{{ STORAGE_NOTE }}</p>
  </footer>

  <ToastHost :message="message" :visible="visible" />
</template>

<style scoped>
.feed-loading {
  padding: var(--space-6) 0;
  text-align: center;
  font-size: 13px;
  letter-spacing: 0.04em;
  color: var(--text-muted);
}

.feed-error {
  padding: var(--space-6) var(--space-4);
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-xl);
  background: rgba(255, 255, 255, 0.55);
  text-align: center;
}

.feed-error p {
  margin-bottom: var(--space-3);
  font-size: 13px;
  color: var(--text-muted);
}

.feed-error button {
  padding: 6px 16px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-pill);
  background: #fff;
  color: var(--brand-1);
  font-size: 13px;
  font-weight: 600;
  transition: border-color var(--dur) var(--ease-out), color var(--dur) var(--ease-out);
}

.feed-error button:hover {
  border-color: var(--brand-1);
  color: var(--brand-2);
}
</style>
