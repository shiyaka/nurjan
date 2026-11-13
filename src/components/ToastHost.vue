<script setup>
defineOptions({ name: 'ToastHost' })

defineProps({
  message: { type: String, default: '' },
  visible: { type: Boolean, default: false }
})
</script>

<template>
  <div class="toast" :class="{ 'is-visible': visible }" role="status" aria-live="polite">
    {{ message }}
  </div>
</template>
