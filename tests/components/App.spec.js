import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import App from '@/App.vue'
import { STORAGE_KEY } from '@/constants'

function mountApp() {
  return mount(App, { global: { plugins: [createPinia()] } })
}

function seed(posts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(posts))
}

describe('App 集成', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('首次进入显示空状态且不显示计数徽标', () => {
    const wrapper = mountApp()

    expect(wrapper.find('.empty-state').exists()).toBe(true)
    expect(wrapper.find('#post-count').exists()).toBe(false)
    wrapper.unmount()
  })

  it('发布后内容置顶、计数更新并写入本地存储', async () => {
    const wrapper = mountApp()

    await wrapper.get('#composer-input').setValue('第一条内容')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.findAll('.post')).toHaveLength(1)
    expect(wrapper.get('.post__content').text()).toBe('第一条内容')
    expect(wrapper.get('#post-count').text()).toBe('1 条')
    expect(wrapper.find('.empty-state').exists()).toBe(false)
    expect(wrapper.get('.toast').classes()).toContain('is-visible')
    expect(wrapper.get('.toast').text()).toBe('已发布，仅保存在本机')

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
    expect(stored).toHaveLength(1)
    expect(stored[0].content).toBe('第一条内容')
    wrapper.unmount()
  })

  it('刷新后从本地存储恢复内容', () => {
    seed([
      { id: 'a', content: '已保存的内容', author: '我', createdAt: Date.now() }
    ])

    const wrapper = mountApp()

    expect(wrapper.findAll('.post')).toHaveLength(1)
    expect(wrapper.get('.post__content').text()).toBe('已保存的内容')
    wrapper.unmount()
  })

  it('两段确认删除后回到空状态并同步存储', async () => {
    seed([{ id: 'a', content: '待删除', author: '我', createdAt: Date.now() }])
    const wrapper = mountApp()

    const button = wrapper.get('.post__delete')
    await button.trigger('click')
    await button.trigger('click')

    expect(wrapper.findAll('.post')).toHaveLength(0)
    expect(wrapper.find('.empty-state').exists()).toBe(true)
    expect(wrapper.get('.toast').text()).toBe('已删除')
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toEqual([])
    wrapper.unmount()
  })
})
