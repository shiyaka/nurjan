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

describe('PostItem 点赞与收藏', () => {
  it('未点赞时 aria-pressed 为 false 且显示点赞计数', () => {
    const wrapper = mount(PostItem, {
      props: { post: makePost({ liked: false, likeCount: 2, favorited: false }) }
    })
    const button = wrapper.get('.post__like')

    expect(button.attributes('aria-pressed')).toBe('false')
    expect(button.attributes('aria-label')).toBe('点赞')
    expect(button.get('.reaction-btn__count').text()).toBe('2')
    expect(button.get('svg').exists()).toBe(true)
  })

  it('已点赞时 aria-pressed 为 true 且提示取消点赞', () => {
    const wrapper = mount(PostItem, {
      props: { post: makePost({ liked: true, likeCount: 3, favorited: false }) }
    })
    const button = wrapper.get('.post__like')

    expect(button.attributes('aria-pressed')).toBe('true')
    expect(button.attributes('aria-label')).toBe('取消点赞')
    expect(button.get('.reaction-btn__count').text()).toBe('3')
  })

  it('点击点赞抛出 like 事件且不直接改 post', async () => {
    const post = makePost({ liked: false, likeCount: 0, favorited: false })
    const wrapper = mount(PostItem, { props: { post } })

    await wrapper.get('.post__like').trigger('click')

    expect(wrapper.emitted('like')).toEqual([['p1']])
    expect(post.liked).toBe(false)
  })

  it('收藏按钮的 aria 状态随 favorited 变化', async () => {
    const wrapper = mount(PostItem, {
      props: { post: makePost({ liked: false, likeCount: 0, favorited: false }) }
    })
    const button = wrapper.get('.post__favorite')

    expect(button.attributes('aria-pressed')).toBe('false')
    expect(button.attributes('aria-label')).toBe('收藏')
    expect(button.get('svg').exists()).toBe(true)

    await wrapper.setProps({ post: makePost({ liked: false, likeCount: 0, favorited: true }) })

    expect(button.attributes('aria-pressed')).toBe('true')
    expect(button.attributes('aria-label')).toBe('取消收藏')
  })

  it('点击收藏抛出 favorite 事件', async () => {
    const wrapper = mount(PostItem, {
      props: { post: makePost({ liked: false, likeCount: 0, favorited: false }) }
    })

    await wrapper.get('.post__favorite').trigger('click')

    expect(wrapper.emitted('favorite')).toEqual([['p1']])
  })

  it('pending 时两个按钮都禁用', () => {
    const wrapper = mount(PostItem, {
      props: { post: makePost({ liked: false, likeCount: 0, favorited: false }), pending: true }
    })

    expect(wrapper.get('.post__like').attributes('disabled')).toBeDefined()
    expect(wrapper.get('.post__favorite').attributes('disabled')).toBeDefined()
    expect(wrapper.get('.post__delete').attributes('disabled')).toBeUndefined()
  })
})
