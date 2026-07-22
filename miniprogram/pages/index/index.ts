import {
  categoryMetas,
  getPrototypeRecords,
  PrototypeRecord,
  savePrototypeRecord,
} from '../../utils/prototype-data'

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

function getTodayMeta(): { dateLabel: string; issueLabel: string } {
  const today = new Date()
  return {
    dateLabel: `${today.getMonth() + 1}月${today.getDate()}日 ${WEEKDAYS[today.getDay()]}`,
    issueLabel: `${today.getFullYear()} / PRIVATE LOG`,
  }
}

Page({
  data: {
    ...getTodayMeta(),
    continueRecords: [] as PrototypeRecord[],
    recentRecords: [] as PrototypeRecord[],
    categorySummary: categoryMetas.map((category) => ({
      ...category,
      count: 0,
    })),
  },

  onShow() {
    this.loadRecords()
  },

  loadRecords() {
    const records = getPrototypeRecords()
    const categorySummary = categoryMetas.map((category) => ({
      ...category,
      count: records.filter((record) => record.category === category.key).length,
    }))

    this.setData({
      continueRecords: records.filter((record) => record.status === 'in-progress'),
      recentRecords: records.slice(0, 4),
      categorySummary,
    })
  },

  openAdd() {
    wx.navigateTo({ url: '/pages/add/add' })
  },

  openAll() {
    wx.redirectTo({ url: '/pages/records/records' })
  },

  openRecord(event: WechatMiniprogram.BaseEvent) {
    const { id } = event.currentTarget.dataset as { id: string }
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` })
  },

  increaseProgress(event: WechatMiniprogram.BaseEvent) {
    const { id } = event.currentTarget.dataset as { id: string }
    const continueRecords = this.data.continueRecords.map((record) => {
      if (record.id !== id) {
        return record
      }

      const currentProgress = record.totalProgress > 0
        ? Math.min(record.totalProgress, record.currentProgress + 1)
        : record.currentProgress + 1
      const progressPercent = record.totalProgress > 0
        ? Math.min(100, Math.round((currentProgress / record.totalProgress) * 100))
        : 0

      return {
        ...record,
        currentProgress,
        progressPercent,
        progressText: record.totalProgress > 0
          ? `看到 ${currentProgress} / ${record.totalProgress} 集`
          : `看到 ${currentProgress} 集`,
      }
    })

    this.setData({ continueRecords })
    const updatedRecord = continueRecords.find((record) => record.id === id)
    if (updatedRecord) {
      savePrototypeRecord(updatedRecord)
    }
    const reachedEnd = updatedRecord
      && updatedRecord.totalProgress > 0
      && updatedRecord.currentProgress >= updatedRecord.totalProgress
    wx.showToast({
      title: reachedEnd ? '已到最后一集' : '进度已 +1',
      icon: 'success',
    })
  },
})
