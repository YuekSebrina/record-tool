import {
  categoryMetas,
  CategoryKey,
  formatTimeMetadata,
  getCategoryMeta,
  getPrototypeRecord,
  getPrototypeRecords,
  getStatusLabel,
  PrototypeRecord,
  savePrototypeRecord,
  StatusKey,
} from '../../utils/prototype-data'

interface StatusOption {
  key: StatusKey
  label: string
  helper: string
}

const statusOptionsByCategory: Record<CategoryKey, StatusOption[]> = {
  book: [
    { key: 'planned', label: '想读', helper: '先放进清单' },
    { key: 'in-progress', label: '在读', helper: '正在阅读' },
    { key: 'completed', label: '已读', helper: '已经读完' },
  ],
  anime: [
    { key: 'planned', label: '想看', helper: '先放进清单' },
    { key: 'in-progress', label: '在看', helper: '之后可更新集数' },
    { key: 'completed', label: '已完成', helper: '已经看完' },
  ],
  movie: [
    { key: 'planned', label: '想看', helper: '先放进清单' },
    { key: 'completed', label: '已看', helper: '已经看完' },
  ],
  kdrama: [
    { key: 'planned', label: '想看', helper: '先放进清单' },
    { key: 'in-progress', label: '在看', helper: '之后可更新集数' },
    { key: 'completed', label: '已完成', helper: '已经看完' },
  ],
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function getCurrentDateTime(): { date: string; time: string } {
  const now = new Date()
  return {
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
  }
}

function getDefaultStatus(category: CategoryKey): StatusKey {
  return category === 'movie' ? 'completed' : 'in-progress'
}

Page({
  data: {
    categories: categoryMetas,
    title: '',
    selectedCategory: 'anime' as CategoryKey,
    selectedStatus: 'in-progress' as StatusKey,
    statusOptions: statusOptionsByCategory.anime,
    ...getCurrentDateTime(),
    isEditing: false,
    currentRecordId: '',
    currentProgress: 0,
    totalProgress: 0,
    showProgressFields: true,
  },

  onLoad(options: Record<string, string | undefined>) {
    if (!options.id) {
      this.setData(getCurrentDateTime())
      return
    }

    const record = getPrototypeRecord(options.id)
    if (!record) {
      return
    }

    const [date = this.data.date, time = this.data.time] = record.recordedAt.split(' ')
    this.setData({
      title: record.title,
      selectedCategory: record.category,
      selectedStatus: record.status,
      statusOptions: statusOptionsByCategory[record.category],
      date,
      time,
      isEditing: true,
      currentRecordId: record.id,
      currentProgress: record.currentProgress,
      totalProgress: record.totalProgress,
      showProgressFields: (record.category === 'anime' || record.category === 'kdrama')
        && record.status === 'in-progress',
    })
  },

  handleTitleInput(event: WechatMiniprogram.Input) {
    this.setData({ title: event.detail.value })
  },

  selectCategory(event: WechatMiniprogram.BaseEvent) {
    const { category } = event.currentTarget.dataset as { category: CategoryKey }
    const selectedStatus = getDefaultStatus(category)
    this.setData({
      selectedCategory: category,
      selectedStatus,
      statusOptions: statusOptionsByCategory[category],
      showProgressFields: (category === 'anime' || category === 'kdrama')
        && selectedStatus === 'in-progress',
    })
  },

  selectStatus(event: WechatMiniprogram.BaseEvent) {
    const { status } = event.currentTarget.dataset as { status: StatusKey }
    this.setData({
      selectedStatus: status,
      showProgressFields: (this.data.selectedCategory === 'anime'
        || this.data.selectedCategory === 'kdrama') && status === 'in-progress',
    })
  },

  handleCurrentProgress(event: WechatMiniprogram.Input) {
    this.setData({ currentProgress: Math.max(0, Number(event.detail.value) || 0) })
  },

  handleTotalProgress(event: WechatMiniprogram.Input) {
    this.setData({ totalProgress: Math.max(0, Number(event.detail.value) || 0) })
  },

  selectDate(event: WechatMiniprogram.PickerChange) {
    this.setData({ date: String(event.detail.value) })
  },

  selectTime(event: WechatMiniprogram.PickerChange) {
    this.setData({ time: String(event.detail.value) })
  },

  saveRecord() {
    const title = this.data.title.trim()
    if (!title) {
      wx.showToast({ title: '先写下作品名称', icon: 'none' })
      return
    }

    const category = getCategoryMeta(this.data.selectedCategory)
    const previousRecord = this.data.currentRecordId
      ? getPrototypeRecord(this.data.currentRecordId)
      : undefined
    const status = this.data.selectedStatus
    const completed = status === 'completed'
    const isSeries = category.key === 'anime' || category.key === 'kdrama'
    const totalProgress = isSeries ? this.data.totalProgress : 0
    const currentProgress = completed && totalProgress > 0
      ? totalProgress
      : isSeries ? Math.min(this.data.currentProgress, totalProgress || Number.MAX_SAFE_INTEGER) : 0
    const progressText = completed
      ? getStatusLabel(category.key, status)
      : status === 'planned'
        ? '已加入清单'
        : currentProgress > 0
          ? totalProgress > 0
            ? `看到 ${currentProgress} / ${totalProgress} 集`
            : `看到 ${currentProgress} 集`
          : '待更新进度'
    const progressPercent = completed
      ? 100
      : totalProgress > 0 ? Math.round((currentProgress / totalProgress) * 100) : 0
    const recordedAt = `${this.data.date} ${this.data.time}`
    const timeMetadata = formatTimeMetadata(recordedAt)
    const record: PrototypeRecord = {
      id: previousRecord?.id || `prototype-${Date.now()}`,
      editionIndex: previousRecord?.editionIndex
        || pad(getPrototypeRecords().length + 1),
      title,
      category: category.key,
      categoryLabel: category.label,
      categoryMark: category.mark,
      status,
      statusLabel: getStatusLabel(category.key, status),
      currentProgress,
      totalProgress,
      progressText,
      progressPercent,
      recordedAt,
      ...timeMetadata,
      note: previousRecord?.note || '一条轻量记录。需要时，可以稍后再补充进度和想法。',
      accentClass: category.accentClass,
    }

    savePrototypeRecord(record)
    wx.showToast({ title: '已留下一条记录', icon: 'success' })

    setTimeout(() => {
      if (this.data.isEditing) {
        wx.navigateBack()
        return
      }
      wx.redirectTo({ url: `/pages/detail/detail?id=${record.id}` })
    }, 500)
  },
})
