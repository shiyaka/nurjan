<script setup>
import { computed, ref } from 'vue'
import { MAX_LENGTH } from '@/constants'

defineOptions({ name: 'PostComposer' })

const props = defineProps({
  maxLength: { type: Number, default: MAX_LENGTH },
  submitting: { type: Boolean, default: false }
})

const emit = defineEmits(['submit'])

const text = ref('')

const length = computed(() => text.value.length)
const canSubmit = computed(() => text.value.trim().length > 0)
const nearLimit = computed(() => length.value >= props.maxLength * 0.9 && length.value < props.maxLength)
const overLimit = computed(() => length.value >= props.maxLength)

function handleSubmit() {
  if (!canSubmit.value || props.submitting) {
    return
  }

  emit('submit', text.value.trim())
  text.value = ''
}

function handleKeydown(event) {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault()
    handleSubmit()
  }
}
</script>

<template>
  <section class="composer" aria-labelledby="composer-title">
    <h1 id="composer-title" class="visually-hidden">发布新内容</h1>
    <form class="composer__form" @submit.prevent="handleSubmit">
      <div class="composer__row">
        <span class="avatar avatar--self" aria-hidden="true">我</span>
        <label class="visually-hidden" for="composer-input">此刻的想法</label>
        <textarea
          id="composer-input"
          v-model="text"
          class="composer__input"
          name="content"
          rows="3"
          :maxlength="maxLength"
          placeholder="此刻的想法，写下来吧…"
          autocomplete="off"
          @keydown="handleKeydown"
        ></textarea>
      </div>
      <div class="composer__footer">
        <p
          class="composer__counter"
          :class="{ 'is-near-limit': nearLimit, 'is-over-limit': overLimit }"
        >
          <span id="counter-value">{{ length }}</span><span class="composer__counter-total"> / {{ maxLength }}</span>
        </p>
        <button
          id="publish-btn"
          class="btn btn--primary"
          type="submit"
          :disabled="!canSubmit || submitting"
        >
          <span>发布</span>
          <svg class="btn__icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
            <path
              d="M4.5 12.5 19 5l-4.2 14.6-3.6-5.1-4.7-1.6Z"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linejoin="round"
            />
            <path d="M11.2 14.5 19 5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
          </svg>
        </button>
      </div>
    </form>
  </section>
</template>
