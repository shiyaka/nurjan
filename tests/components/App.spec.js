import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import App from '@/App.vue'

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  }
}

function noContentResponse() {
  return {
    ok: true,
    status: 204,
    json: async () => {
      throw new SyntaxError('Unexpected end of JSON input')
    }
  }
}

function stubFetch(impl) {
  const fetchMock = vi.fn(impl)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function servePosts(posts) {
  return stubFetch(async () => jsonResponse({ data: posts }))
}

function mountApp() {
  return mount(App, { global: { plugins: [createPinia()] } })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('App 集成', () => {
  it('首次加载先显示加载态，加载完成且无数据时显示空状态', async () => {
    let release
    const fetchMock = stubFetch(
      () =>
        new Promise((resolve) => {
          release = resolve
        })
    )

    const wrapper = mountApp()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.feed-loading').exists()).toBe(true)
    expect(wrapper.get('.feed-loading').text()).toBe('正在加载…')
    expect(wrapper.get('.feed-loading').attributes('role')).toBe('status')
    expect(wrapper.find('.empty-state').exists()).toBe(false)

    release(jsonResponse({ data: [] }))
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(wrapper.find('.feed-loading').exists()).toBe(false)
    expect(wrapper.find('.empty-state').exists()).toBe(true)
    expect(wrapper.get('.empty-state__hint').text()).toContain('服务端')
    expect(wrapper.find('#post-count').exists()).toBe(false)
    wrapper.unmount()
  })

  it('发布后新内容置顶、计数更新并向服务端提交', async () => {
    const existing = { id: 'a', content: '旧内容', author: '我', createdAt: 1000 }
    const created = { id: 'b', content: '第一条内容', author: '我', createdAt: 2000 }
    const fetchMock = stubFetch(async (url, options) => {
      if (options?.method === 'POST') return jsonResponse({ data: created }, 201)
      return jsonResponse({ data: [existing] })
    })

    const wrapper = mountApp()
    await flushPromises()

    await wrapper.get('#composer-input').setValue('第一条内容')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    const posts = wrapper.findAll('.post')
    expect(posts).toHaveLength(2)
    expect(posts[0].get('.post__content').text()).toBe('第一条内容')
    expect(wrapper.get('#post-count').text()).toBe('2 条')
    expect(wrapper.find('.empty-state').exists()).toBe(false)
    expect(wrapper.get('.toast').classes()).toContain('is-visible')
    expect(wrapper.get('.toast').text()).toBe('已发布')

    const postCall = fetchMock.mock.calls.find(([, options]) => options?.method === 'POST')
    expect(postCall[0]).toBe('/api/posts')
    expect(postCall[1].headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(postCall[1].body)).toEqual({ content: '第一条内容' })
    wrapper.unmount()
  })

  it('刷新后从服务端恢复内容并按时间倒序展示', async () => {
    servePosts([
      { id: 'a', content: '较早的内容', author: '我', createdAt: 1000 },
      { id: 'b', content: '较新的内容', author: '我', createdAt: 2000 }
    ])

    const wrapper = mountApp()
    await flushPromises()

    const posts = wrapper.findAll('.post')
    expect(posts).toHaveLength(2)
    expect(posts[0].get('.post__content').text()).toBe('较新的内容')
    expect(posts[1].get('.post__content').text()).toBe('较早的内容')
    wrapper.unmount()
  })

  it('两段确认删除后回到空状态并向服务端发起 DELETE', async () => {
    const fetchMock = stubFetch(async (url, options) => {
      if (options?.method === 'DELETE') return noContentResponse()
      return jsonResponse({
        data: [{ id: 'a', content: '待删除', author: '我', createdAt: 1000 }]
      })
    })

    const wrapper = mountApp()
    await flushPromises()

    const button = wrapper.get('.post__delete')
    await button.trigger('click')
    await button.trigger('click')
    await flushPromises()

    expect(wrapper.findAll('.post')).toHaveLength(0)
    expect(wrapper.find('.empty-state').exists()).toBe(true)
    expect(wrapper.get('.toast').text()).toBe('已删除')

    const deleteCall = fetchMock.mock.calls.find(([, options]) => options?.method === 'DELETE')
    expect(deleteCall[0]).toBe('/api/posts/a')
    wrapper.unmount()
  })

  it('发布失败时提示服务不可用且列表保持不变', async () => {
    const fetchMock = stubFetch(async (url, options) => {
      if (options?.method === 'POST') {
        return jsonResponse({ error: { code: 'BOOM', message: '服务器错误' } }, 500)
      }
      return jsonResponse({ data: [] })
    })

    const wrapper = mountApp()
    await flushPromises()

    await wrapper.get('#composer-input').setValue('无法发布')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(wrapper.findAll('.post')).toHaveLength(0)
    expect(wrapper.find('.empty-state').exists()).toBe(true)
    expect(wrapper.get('.toast').text()).toBe('操作失败，请检查服务是否可用')
    wrapper.unmount()
  })

  it('内容超长时给出长度限制提示', async () => {
    stubFetch(async (url, options) => {
      if (options?.method === 'POST') {
        return jsonResponse(
          { error: { code: 'CONTENT_TOO_LONG', message: '内容超出长度限制' } },
          422
        )
      }
      return jsonResponse({ data: [] })
    })

    const wrapper = mountApp()
    await flushPromises()

    await wrapper.get('#composer-input').setValue('超长内容')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.get('.toast').text()).toBe('内容超出长度限制')
    wrapper.unmount()
  })

  it('初始加载失败时显示错误提示，重试成功后恢复', async () => {
    let calls = 0
    stubFetch(async () => {
      calls += 1
      if (calls === 1) throw new TypeError('Failed to fetch')
      return jsonResponse({ data: [] })
    })

    const wrapper = mountApp()
    await flushPromises()

    expect(wrapper.get('.feed-error').text()).toContain('加载失败')
    expect(wrapper.find('.empty-state').exists()).toBe(false)

    await wrapper.get('.feed-error button').trigger('click')
    await flushPromises()

    expect(wrapper.find('.feed-error').exists()).toBe(false)
    expect(wrapper.find('.empty-state').exists()).toBe(true)
    wrapper.unmount()
  })

  it('删除失败时提示服务不可用且列表保持不变', async () => {
    stubFetch(async (url, options) => {
      if (options?.method === 'DELETE') return jsonResponse({ error: { code: 'BOOM' } }, 500)
      return jsonResponse({
        data: [{ id: 'a', content: '保留的内容', author: '我', createdAt: 1000 }]
      })
    })

    const wrapper = mountApp()
    await flushPromises()

    const button = wrapper.get('.post__delete')
    await button.trigger('click')
    await button.trigger('click')
    await flushPromises()

    expect(wrapper.findAll('.post')).toHaveLength(1)
    expect(wrapper.get('.toast').text()).toBe('操作失败，请检查服务是否可用')
    wrapper.unmount()
  })
})

const basePost = {
  id: 'a',
  content: '可互动的内容',
  author: '我',
  createdAt: 1000,
  liked: false,
  likeCount: 0,
  favorited: false
}

describe('App 点赞与收藏', () => {
  it('点赞成功后按服务端返回更新状态与计数', async () => {
    const updated = { ...basePost, liked: true, likeCount: 1 }
    const fetchMock = stubFetch(async (url, options) => {
      if (options?.method === 'PATCH') return jsonResponse({ data: updated })
      return jsonResponse({ data: [basePost] })
    })

    const wrapper = mountApp()
    await flushPromises()

    expect(wrapper.get('.post__like').attributes('aria-pressed')).toBe('false')

    await wrapper.get('.post__like').trigger('click')
    await flushPromises()

    const button = wrapper.get('.post__like')
    expect(button.attributes('aria-pressed')).toBe('true')
    expect(button.attributes('aria-label')).toBe('取消点赞')
    expect(button.text()).toContain('1')

    const patchCall = fetchMock.mock.calls.find(([, options]) => options?.method === 'PATCH')
    expect(patchCall[0]).toBe('/api/posts/a')
    expect(JSON.parse(patchCall[1].body)).toEqual({ liked: true })
    wrapper.unmount()
  })

  it('点赞失败时提示服务不可用且状态不变', async () => {
    stubFetch(async (url, options) => {
      if (options?.method === 'PATCH') return jsonResponse({ error: { code: 'BOOM' } }, 500)
      return jsonResponse({ data: [basePost] })
    })

    const wrapper = mountApp()
    await flushPromises()

    await wrapper.get('.post__like').trigger('click')
    await flushPromises()

    expect(wrapper.get('.post__like').attributes('aria-pressed')).toBe('false')
    expect(wrapper.get('.toast').text()).toBe('操作失败，请检查服务是否可用')
    wrapper.unmount()
  })

  it('收藏后切到收藏筛选只显示已收藏内容且计数一致', async () => {
    const favorited = { ...basePost, id: 'b', createdAt: 2000, favorited: true }
    const other = { ...basePost, id: 'c', createdAt: 3000 }
    stubFetch(async () => jsonResponse({ data: [basePost, favorited, other] }))

    const wrapper = mountApp()
    await flushPromises()

    expect(wrapper.get('#post-count').text()).toBe('3 条')

    await wrapper.get('[data-filter="favorites"]').trigger('click')

    const posts = wrapper.findAll('.post')
    expect(posts).toHaveLength(1)
    expect(posts[0].get('.post__content').text()).toBe('可互动的内容')
    expect(wrapper.get('#post-count').text()).toBe('1 条')

    await wrapper.get('[data-filter="all"]').trigger('click')

    expect(wrapper.findAll('.post')).toHaveLength(3)
    expect(wrapper.get('#post-count').text()).toBe('3 条')
    wrapper.unmount()
  })

  it('收藏为空时显示提示且不显示计数徽标', async () => {
    stubFetch(async () => jsonResponse({ data: [basePost] }))

    const wrapper = mountApp()
    await flushPromises()

    await wrapper.get('[data-filter="favorites"]').trigger('click')

    expect(wrapper.findAll('.post')).toHaveLength(0)
    expect(wrapper.find('#post-count').exists()).toBe(false)
    expect(wrapper.get('.feed-empty').text()).toContain('还没有收藏的内容')
    expect(wrapper.find('.empty-state').exists()).toBe(false)
    wrapper.unmount()
  })

  it('在收藏筛选中取消收藏后卡片移出列表', async () => {
    const favorited = { ...basePost, favorited: true }
    const unfavorited = { ...basePost, favorited: false }
    const fetchMock = stubFetch(async (url, options) => {
      if (options?.method === 'PATCH') return jsonResponse({ data: unfavorited })
      return jsonResponse({ data: [favorited] })
    })

    const wrapper = mountApp()
    await flushPromises()

    await wrapper.get('[data-filter="favorites"]').trigger('click')
    expect(wrapper.findAll('.post')).toHaveLength(1)

    await wrapper.get('.post__favorite').trigger('click')
    await flushPromises()

    expect(wrapper.findAll('.post')).toHaveLength(0)
    expect(wrapper.get('.feed-empty').text()).toContain('还没有收藏的内容')

    const patchCall = fetchMock.mock.calls.find(([, options]) => options?.method === 'PATCH')
    expect(JSON.parse(patchCall[1].body)).toEqual({ favorited: false })
    wrapper.unmount()
  })
})
