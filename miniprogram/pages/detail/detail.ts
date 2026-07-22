import {
  getPrototypeRecord,
  getPrototypeRecords,
  PrototypeRecord,
  savePrototypeRecord,
} from '../../utils/prototype-data'

interface TimelineEntry {
  date: string
  time: string
  title: string
  detail: string
  active: boolean
}

function buildTimeline(record: PrototypeRecord): TimelineEntry[] {
  const time = record.recordedAt.split(' ')[1] || '--:--'
  const date = record.timeLabel.split(' ')[0] || record.recordedAt.split(' ')[0]
  const mainTitle = record.status === 'completed' ? '标记为已完成' : '更新了当前状态'
  return [
    {
      date,
      time,
      title: mainTitle,
      detail: record.progressText,
      active: true,
    },
  ]
}

Page({
  data: {
    record: getPrototypeRecords()[0],
    timeline: [] as TimelineEntry[],
    currentRecordId: '',
  },

  onLoad(options: Record<string, string | undefined>) {
    this.setData({ currentRecordId: options.id || getPrototypeRecords()[0].id })
  },

  onShow() {
    this.loadRecord()
  },

  loadRecord() {
    const record = getPrototypeRecord(this.data.currentRecordId) || getPrototypeRecords()[0]
    this.setData({
      record,
      timeline: buildTimeline(record),
    })
  },

  editRecord() {
    wx.navigateTo({ url: `/pages/add/add?id=${this.data.record.id}` })
  },

  increaseProgress() {
    const record = this.data.record
    const currentProgress = record.totalProgress > 0
      ? Math.min(record.totalProgress, record.currentProgress + 1)
      : record.currentProgress + 1
    const progressPercent = record.totalProgress > 0
      ? Math.min(100, Math.round((currentProgress / record.totalProgress) * 100))
      : 0
    const updatedRecord: PrototypeRecord = {
      ...record,
      currentProgress,
      progressPercent,
      progressText: record.totalProgress > 0
        ? `看到 ${currentProgress} / ${record.totalProgress} 集`
        : `看到 ${currentProgress} 集`,
    }

    savePrototypeRecord(updatedRecord)
    this.setData({
      record: updatedRecord,
      timeline: buildTimeline(updatedRecord),
    })
    wx.showToast({
      title: record.totalProgress > 0 && currentProgress >= record.totalProgress
        ? '已到最后一集'
        : '进度已 +1',
      icon: 'success',
    })
  },

  markComplete() {
    const record = this.data.record
    const updatedRecord: PrototypeRecord = {
      ...record,
      status: 'completed',
      statusLabel: record.category === 'book'
        ? '已读'
        : record.category === 'movie' ? '已看' : '已完成',
      progressText: record.category === 'book'
        ? '已读完'
        : record.category === 'movie' ? '已看完' : '已完成',
      progressPercent: 100,
    }

    savePrototypeRecord(updatedRecord)
    this.setData({
      record: updatedRecord,
      timeline: buildTimeline(updatedRecord),
    })
    wx.showToast({ title: '已标记完成', icon: 'success' })
  },

  confirmDelete() {
    wx.showModal({
      title: '删除这条记录？',
      content: 'Phase 1 原型暂不执行真实删除，后续会提供撤销入口。',
      confirmText: '我知道了',
      showCancel: false,
    })
  },
})
