import {
  EntryStatus,
  EntryType,
  getPrototypeEntries,
  PrototypeEntry,
  savePrototypeEntry,
} from '../../utils/prototype-data'

type TypeFilter = EntryType | 'all'
type StatusFilter = EntryStatus | 'all'

Page({
  data: {
    keyword: '',
    selectedType: 'all' as TypeFilter,
    selectedStatus: 'all' as StatusFilter,
    typeFilters: [
      { key: 'all', label: '全部' },
      { key: 'note', label: '随记' },
      { key: 'todo', label: '待办' },
      { key: 'media', label: '书影音' },
    ],
    statusFilters: [
      { key: 'all', label: '全部状态' },
      { key: 'active', label: '进行中' },
      { key: 'planned', label: '计划中' },
      { key: 'completed', label: '已完成' },
    ],
    entries: [] as PrototypeEntry[],
    totalCount: 0,
    previewVisible: false,
    selectedEntry: null as PrototypeEntry | null,
  },

  onShow() {
    this.filterEntries()
  },

  handleSearch(event: WechatMiniprogram.Input) {
    this.setData({ keyword: event.detail.value })
    this.filterEntries(event.detail.value)
  },

  selectType(event: WechatMiniprogram.BaseEvent) {
    const { type } = event.currentTarget.dataset as { type: TypeFilter }
    this.setData({ selectedType: type })
    this.filterEntries(undefined, type)
  },

  selectStatus(event: WechatMiniprogram.BaseEvent) {
    const { status } = event.currentTarget.dataset as { status: StatusFilter }
    this.setData({ selectedStatus: status })
    this.filterEntries(undefined, undefined, status)
  },

  filterEntries(
    nextKeyword?: string,
    nextType?: TypeFilter,
    nextStatus?: StatusFilter,
  ) {
    const allEntries = getPrototypeEntries()
    const keywordValue = nextKeyword !== undefined ? nextKeyword : this.data.keyword
    const keyword = keywordValue.trim().toLowerCase()
    const type = nextType !== undefined ? nextType : this.data.selectedType
    const status = nextStatus !== undefined ? nextStatus : this.data.selectedStatus
    const entries = allEntries.filter((entry) => {
      const matchesKeyword = !keyword
        || entry.content.toLowerCase().includes(keyword)
        || entry.detail.toLowerCase().includes(keyword)
      const matchesType = type === 'all' || entry.type === type
      const matchesStatus = status === 'all'
        || (entry.type !== 'note' && entry.status === status)
      return matchesKeyword && matchesType && matchesStatus
    })
    this.setData({ entries, totalCount: allEntries.length })
  },

  clearFilters() {
    this.setData({ keyword: '', selectedType: 'all', selectedStatus: 'all' })
    this.filterEntries('', 'all', 'all')
  },

  openEntry(event: WechatMiniprogram.BaseEvent) {
    const { id } = event.currentTarget.dataset as { id: string }
    const selectedEntry = this.data.entries.find((entry) => entry.id === id)
    if (!selectedEntry) {
      return
    }
    this.setData({ selectedEntry, previewVisible: true })
  },

  closePreview() {
    this.setData({ previewVisible: false })
  },

  preventClose() {},

  openSelectedEntry() {
    const selectedEntry = this.data.selectedEntry
    if (!selectedEntry) {
      return
    }
    this.setData({ previewVisible: false })
    wx.navigateTo({ url: `/pages/detail/detail?id=${selectedEntry.id}` })
  },

  increasePreviewProgress() {
    const entry = this.data.selectedEntry
    if (!entry
      || entry.type !== 'media'
      || entry.status !== 'active'
      || (entry.mediaCategory !== 'anime' && entry.mediaCategory !== 'kdrama')) {
      return
    }
    if (entry.totalProgress > 0 && entry.currentProgress >= entry.totalProgress) {
      wx.showToast({ title: '已经是最后一集', icon: 'none' })
      return
    }

    const currentProgress = entry.totalProgress > 0
      ? Math.min(entry.totalProgress, entry.currentProgress + 1)
      : entry.currentProgress + 1
    const updatedEntry: PrototypeEntry = {
      ...entry,
      currentProgress,
      progressText: entry.totalProgress > 0
        ? `${currentProgress} / ${entry.totalProgress} 集`
        : `第 ${currentProgress} 集`,
    }
    savePrototypeEntry(updatedEntry)
    this.setData({ selectedEntry: updatedEntry })
    this.filterEntries()
    wx.showToast({ title: '进度已更新', icon: 'success' })
  },

  openAdd() {
    wx.navigateTo({ url: '/pages/add/add' })
  },
})
