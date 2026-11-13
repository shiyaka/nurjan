import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import PostItem from '@/components/PostItem.vue'

function makePost(overrides = {}) {
  return {
    id: 'p1',
    content: '你好 <b>粗体</b>',
    author: '我',
    createdAt: Date.now(),
    ...overrides
  }
}

describe('PostItem', () => {
  it('正文按纯文本渲染，不解析 HTML', () => {
    const wrapper = mount(PostItem, { props: { post: makePost() } })

    expect(wrapper.get('.post__content').text()).toContain('<b>粗体</b>')
    expect(wrapper.find('.post__content b').exists()).toBe(false)
  })

  it('显示作者与相对时间', () => {
    const wrapper = mount(PostItem, { props: { post: makePost({ createdAt: Date.now() }) } })

    expect(wrapper.get('.post__author').text()).toBe('我')
    expect(wrapper.get('.post__time').text()).toBe('刚刚')
  })

  it('两段式确认后才抛出 remove 事件', async () => {
    const wrapper = mount(PostItem, { props: { post: makePost() } })
    const button = wrapper.get('.post__delete')

    await button.trigger('click')
    expect(button.text()).toBe('确认删除')
    expect(wrapper.emitted('remove')).toBeUndefined()

    await button.trigger('click')
    expect(wrapper.emitted('remove')).toEqual([['p1']])
  })

  it('超时后确认态自动还原', async () => {
    vi.useFakeTimers()
    const wrapper = mount(PostItem, { props: { post: makePost() } })
    const button = wrapper.get('.post__delete')

    await button.trigger('click')
    expect(button.text()).toBe('确认删除')

    vi.advanceTimersByTime(3200)
    await wrapper.vm.$nextTick()

    expect(button.text()).toBe('删除')
  })

  it('卸载时清理确认定时器', async () => {
    vi.useFakeTimers()
    const wrapper = mount(PostItem, { props: { post: makePost() } })

    await wrapper.get('.post__delete').trigger('click')
    wrapper.unmount()

    expect(vi.getTimerCount()).toBe(0)
  })
})
