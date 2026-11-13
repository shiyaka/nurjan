import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PostComposer from '@/components/PostComposer.vue'

function mountComposer() {
  return mount(PostComposer)
}

describe('PostComposer', () => {
  it('初始状态不可发布，计数为 0', () => {
    const wrapper = mountComposer()

    expect(wrapper.get('#publish-btn').attributes('disabled')).toBeDefined()
    expect(wrapper.get('#counter-value').text()).toBe('0')
  })

  it('输入内容后启用发布并同步计数', async () => {
    const wrapper = mountComposer()

    await wrapper.get('#composer-input').setValue('你好')

    expect(wrapper.get('#publish-btn').attributes('disabled')).toBeUndefined()
    expect(wrapper.get('#counter-value').text()).toBe('2')
  })

  it('仅空白字符时仍不可发布', async () => {
    const wrapper = mountComposer()

    await wrapper.get('#composer-input').setValue('   \n  ')

    expect(wrapper.get('#publish-btn').attributes('disabled')).toBeDefined()
  })

  it('接近上限时显示警示样式', async () => {
    const wrapper = mountComposer()

    await wrapper.get('#composer-input').setValue('字'.repeat(252))

    expect(wrapper.get('.composer__counter').classes()).toContain('is-near-limit')
  })

  it('提交时抛出 trim 后的内容并清空输入', async () => {
    const wrapper = mountComposer()

    await wrapper.get('#composer-input').setValue('  第一条内容  ')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('submit')).toEqual([['第一条内容']])
    expect(wrapper.get('#composer-input').element.value).toBe('')
    expect(wrapper.get('#counter-value').text()).toBe('0')
  })

  it('Ctrl + Enter 可快捷提交', async () => {
    const wrapper = mountComposer()

    await wrapper.get('#composer-input').setValue('快捷键发布')
    await wrapper.get('#composer-input').trigger('keydown', { key: 'Enter', ctrlKey: true })

    expect(wrapper.emitted('submit')).toEqual([['快捷键发布']])
  })

  it('空白内容按 Ctrl + Enter 不会提交', async () => {
    const wrapper = mountComposer()

    await wrapper.get('#composer-input').setValue('   ')
    await wrapper.get('#composer-input').trigger('keydown', { key: 'Enter', ctrlKey: true })

    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('提交流程进行中禁用按钮且不重复提交', async () => {
    const wrapper = mount(PostComposer, { props: { submitting: true } })

    await wrapper.get('#composer-input').setValue('内容')
    expect(wrapper.get('#publish-btn').attributes('disabled')).toBeDefined()

    await wrapper.get('#composer-input').trigger('keydown', { key: 'Enter', ctrlKey: true })
    expect(wrapper.emitted('submit')).toBeUndefined()
  })
})
