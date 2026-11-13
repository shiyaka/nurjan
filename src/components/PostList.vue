<script setup>
import PostItem from '@/components/PostItem.vue'

defineOptions({ name: 'PostList' })

defineProps({
  posts: { type: Array, required: true },
  isPending: { type: Function, default: () => () => false }
})

const emit = defineEmits(['remove', 'like', 'favorite'])
</script>

<template>
  <TransitionGroup tag="ul" name="feed" class="feed" aria-live="polite">
    <PostItem
      v-for="post in posts"
      :key="post.id"
      :post="post"
      :pending="isPending(post.id)"
      @remove="emit('remove', $event)"
      @like="emit('like', $event)"
      @favorite="emit('favorite', $event)"
    />
  </TransitionGroup>
</template>
