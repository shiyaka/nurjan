<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { DELETE_CONFIRM_TIMEOUT } from '@/constants'
import { formatRelativeTime } from '@/utils/time'

defineOptions({ name: 'PostItem' })

const props = defineProps({
  post: { type: Object, required: true }
})

const emit = defineEmits(['remove'])

const confirming = ref(false)
let timer = null

const avatarLetter = computed(() => (props.post.author || '我').slice(0, 1))
const relativeTime = computed(() => formatRelativeTime(props.post.createdAt))
const isoTime = computed(() => new Date(props.post.createdAt).toISOString())
const fullTime = computed(() => new Date(props.post.createdAt).toLocaleString('zh-CN'))

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
