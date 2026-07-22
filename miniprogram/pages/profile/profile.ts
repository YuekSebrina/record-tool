import {
  categoryMetas,
  getPrototypeRecords,
} from '../../utils/prototype-data'

function getMonthValue(): string {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
}

Page({
  data: {
    statistics: [
      { value: '18', label: '全部记录' },
      { value: '03', label: '进行中' },
      { value: '11', label: '已完成' },
    ],
    categoryStatistics: [
      { mark: '书', label: '书籍', value: 5, accentClass: 'accent--book' },
      { mark: '漫', label: '动漫', value: 6, accentClass: 'accent--anime' },
      { mark: '影', label: '电影', value: 4, accentClass: 'accent--movie' },
      { mark: '韩', label: '韩剧', value: 3, accentClass: 'accent--kdrama' },
    ],
    periodLabel: getMonthValue().replace('-', ' / '),
    monthRecordCount: 0,
  },

  onShow() {
    const records = getPrototypeRecords()
    const monthValue = getMonthValue()
    this.setData({
      statistics: [
        { value: String(records.length).padStart(2, '0'), label: '全部记录' },
        {
          value: String(records.filter((record) => record.status === 'in-progress').length).padStart(2, '0'),
          label: '进行中',
        },
        {
          value: String(records.filter((record) => record.status === 'completed').length).padStart(2, '0'),
          label: '已完成',
        },
      ],
      categoryStatistics: categoryMetas.map((category) => ({
        mark: category.mark,
        label: category.label,
        value: records.filter((record) => record.category === category.key).length,
        accentClass: category.accentClass,
      })),
      periodLabel: monthValue.replace('-', ' / '),
      monthRecordCount: records.filter((record) => record.recordedAt.startsWith(monthValue)).length,
    })
  },

  previewProfileSetup() {
    wx.showModal({
      title: '微信资料将在 Phase 3 接入',
      content: '正式版本会由你主动选择微信头像并填写昵称，不会静默读取资料。',
      confirmText: '知道了',
      showCancel: false,
    })
  },

  openPreference() {
    wx.showToast({ title: '偏好设置将在后续阶段接入', icon: 'none' })
  },

  openPrivacy() {
    wx.showModal({
      title: '数据与隐私',
      content: '所有书影音记录默认仅本人可见，正式版本支持注销账号和删除数据。',
      confirmText: '知道了',
      showCancel: false,
    })
  },

  openAbout() {
    wx.showModal({
      title: '关于留痕',
      content: '一个打开就能记录的私人书影音手账。当前为 Phase 1 产品原型。',
      confirmText: '关闭',
      showCancel: false,
    })
  },
})
