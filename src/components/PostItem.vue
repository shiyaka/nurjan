<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { DELETE_CONFIRM_TIMEOUT } from '@/constants'
import { formatRelativeTime } from '@/utils/time'

defineOptions({ name: 'PostItem' })

const props = defineProps({
  post: { type: Object, required: true },
  pending: { type: Boolean, default: false }
})

const emit = defineEmits(['remove', 'like', 'favorite'])

const confirming = ref(false)
let timer = null

const avatarLetter = computed(() => (props.post.author || '我').slice(0, 1))
const relativeTime = computed(() => formatRelativeTime(props.post.createdAt))
const isoTime = computed(() => new Date(props.post.createdAt).toISOString())
const fullTime = computed(() => new Date(props.post.createdAt).toLocaleString('zh-CN'))
const liked = computed(() => props.post.liked === true)
const favorited = computed(() => props.post.favorited === true)
const likeCount = computed(() => {
  const value = Number(props.post.likeCount)
  return Number.isFinite(value) && value > 0 ? value : 0
})

function clearTimer() {
  if (timer !== null) {
    clearTimeout(timer)
    timer = null
  }
}

function handleDelete() {
  if (!confirming.value) {
    confirming.value = true
    clearTimer()
    timer = setTimeout(() => {
      confirming.value = false
      timer = null
    }, DELETE_CONFIRM_TIMEOUT)
    return
  }

  clearTimer()
  confirming.value = false
  emit('remove', props.post.id)
}

onBeforeUnmount(clearTimer)
</script>

<template>
  <li class="post">
    <span class="avatar post__avatar" aria-hidden="true">{{ avatarLetter }}</span>
    <div class="post__body">
      <div class="post__meta">
        <span class="post__author">{{ post.author }}</span>
        <time class="post__time" :datetime="isoTime" :title="fullTime">{{ relativeTime }}</time>
      </div>
      <p class="post__content">{{ post.content }}</p>
      <div class="post__actions">
        <div class="post__reactions">
          <button
            class="reaction-btn post__like"
            :class="{ 'is-active': liked }"
            type="button"
            :aria-pressed="liked ? 'true' : 'false'"
            :aria-label="liked ? '取消点赞' : '点赞'"
            :disabled="pending"
            @click="emit('like', post.id)"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
              <path
                d="M12 20.3S4.8 15.9 4.8 10.9a4.3 4.3 0 0 1 7.2-3.2 4.3 4.3 0 0 1 7.2 3.2c0 5-7.2 9.4-7.2 9.4Z"
                :fill="liked ? 'currentColor' : 'none'"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linejoin="round"
              />
            </svg>
            <span class="reaction-btn__count">{{ likeCount }}</span>
          </button>

          <button
            class="reaction-btn post__favorite"
            :class="{ 'is-active': favorited }"
            type="button"
            :aria-pressed="favorited ? 'true' : 'false'"
            :aria-label="favorited ? '取消收藏' : '收藏'"
            :disabled="pending"
            @click="emit('favorite', post.id)"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
              <path
                d="M6.6 4.6h10.8v15.2L12 15.9l-5.4 3.9Z"
                :fill="favorited ? 'currentColor' : 'none'"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linejoin="round"
              />
            </svg>
          </button>
        </div>

        <button
          class="link-btn post__delete"
          :class="{ 'is-confirming': confirming }"
          type="button"
          :aria-label="confirming ? '再次点击确认删除' : '删除这条内容'"
          @click="handleDelete"
        >
          {{ confirming ? '确认删除' : '删除' }}
        </button>
      </div>
    </div>
  </li>
</template>
