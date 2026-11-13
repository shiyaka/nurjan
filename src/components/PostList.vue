<script setup>
import PostItem from '@/components/PostItem.vue'

defineOptions({ name: 'PostList' })

defineProps({
  posts: { type: Array, required: true }
})

const emit = defineEmits(['remove'])
</script>

<template>
  <TransitionGroup tag="ul" name="feed" class="feed" aria-live="polite">
    <PostItem
      v-for="post in posts"
      :key="post.id"
      :post="post"
      @remove="emit('remove', $event)"
    />
  </TransitionGroup>
</template>
