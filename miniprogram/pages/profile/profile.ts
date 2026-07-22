import { getPrototypeEntries } from '../../utils/prototype-data'

Page({
  data: {
    statistics: [
      { value: 0, label: '随记' },
      { value: 0, label: '待办' },
      { value: 0, label: '书影音' },
    ],
    completedTodoCount: 0,
    totalTodoCount: 0,
  },

  onShow() {
    const entries = getPrototypeEntries()
    const todos = entries.filter((entry) => entry.type === 'todo')
    this.setData({
      statistics: [
        { value: entries.filter((entry) => entry.type === 'note').length, label: '随记' },
        { value: todos.length, label: '待办' },
        { value: entries.filter((entry) => entry.type === 'media').length, label: '书影音' },
      ],
      completedTodoCount: todos.filter((entry) => entry.completed).length,
      totalTodoCount: todos.length,
    })
  },

  previewProfileSetup() {
    wx.showModal({
      title: '微信资料将在后续接入',
      content: '正式版本会由你主动选择微信头像并填写昵称。',
      confirmText: '知道了',
      showCancel: false,
    })
  },
})
