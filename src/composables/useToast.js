import { onScopeDispose, ref } from 'vue'
import { TOAST_DURATION } from '@/constants'

/**
 * 单条轻提示状态：同一时刻只展示一条，重复调用会重置计时器。
 */
export function useToast(duration = TOAST_DURATION) {
  const message = ref('')
  const visible = ref(false)
  let timer = null

  function clear() {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  function show(text) {
    message.value = text
    visible.value = true
    clear()
    timer = setTimeout(() => {
      visible.value = false
      timer = null
    }, duration)
  }

  function dispose() {
    clear()
  }

  onScopeDispose(dispose)

  return { message, visible, show, dispose }
}
