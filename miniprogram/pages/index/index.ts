import {
  EntryStatus,
  EntryType,
  entryTypeOptions,
  formatTimeMetadata,
  getCurrentDateTime,
  getMediaCategory,
  getMediaStatusLabel,
  getMediaStatusOptions,
  getPrototypeEntries,
  getPrototypeEntry,
  mediaCategoryOptions,
  MediaCategory,
  PrototypeEntry,
  savePrototypeEntry,
} from '../../utils/prototype-data'

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const COMPOSER_DRAFT_KEY = 'phase-one-composer-draft'
const COMPOSER_SAVED_KEY = 'phase-one-composer-saved'
let layoutTimer: number | undefined

function getDateLabel(): string {
  const today = new Date()
  return `${today.getMonth() + 1}月${today.getDate()}日 ${WEEKDAYS[today.getDay()]}`
}

Page({
  data: {
    dateLabel: getDateLabel(),
    draft: '',
    selectedType: 'note' as EntryType,
    placeholder: entryTypeOptions[0].placeholder,
    typeOptions: entryTypeOptions,
    mediaCategories: mediaCategoryOptions,
    selectedMediaCategory: 'anime' as MediaCategory,
    selectedMediaStatus: 'active' as EntryStatus,
    mediaStatusOptions: getMediaStatusOptions('anime'),
    entries: [] as PrototypeEntry[],
    previewVisible: false,
    selectedEntry: null as PrototypeEntry | null,
    composerMinHeight: 0,
    layoutScrollable: false,
  },

  onShow() {
    if (wx.getStorageSync<boolean>(COMPOSER_SAVED_KEY)) {
      this.setData({ draft: '' })
      wx.removeStorageSync(COMPOSER_SAVED_KEY)
    }
    this.loadEntries()
  },

  onReady() {
    this.scheduleHomeLayout()
  },

  onResize() {
    this.scheduleHomeLayout()
  },

  loadEntries(recalculateLayout = true) {
    this.setData({ entries: getPrototypeEntries().slice(0, 5) }, () => {
      if (recalculateLayout) {
        this.scheduleHomeLayout()
      }
    })
  },

  scheduleHomeLayout() {
    this.setData({ composerMinHeight: 0, layoutScrollable: false }, () => {
      wx.nextTick(() => this.measureHomeLayout())
    })
  },

  measureHomeLayout() {
    const query = this.createSelectorQuery()
    query.select('.composer').boundingClientRect()
    query.select('.recent-content').boundingClientRect()
    query.exec((results) => {
      const composerRect = results[0] as WechatMiniprogram.BoundingClientRectCallbackResult | null
      const recentRect = results[1] as WechatMiniprogram.BoundingClientRectCallbackResult | null
      if (!composerRect || !recentRect) {
        return
      }

      const bottomNav = this.selectComponent('#home-bottom-nav')
      if (bottomNav) {
        const bottomNavQuery = bottomNav.createSelectorQuery()
        bottomNavQuery.select('.bottom-nav').boundingClientRect()
        bottomNavQuery.exec((bottomNavResults) => {
          const bottomNavRect = bottomNavResults[0] as WechatMiniprogram.BoundingClientRectCallbackResult | null
          if (bottomNavRect) {
            this.applyHomeLayout(composerRect, recentRect, bottomNavRect.top)
            return
          }
          this.applyHomeLayout(composerRect, recentRect, this.getFallbackNavTop())
        })
        return
      }

      this.applyHomeLayout(composerRect, recentRect, this.getFallbackNavTop())
    })
  },

  getFallbackNavTop(): number {
    const systemInfo = wx.getSystemInfoSync()
    const safeBottom = systemInfo.safeArea
      ? systemInfo.screenHeight - systemInfo.safeArea.bottom
      : 0
    return systemInfo.windowHeight
      - systemInfo.windowWidth * 100 / 750
      - safeBottom
  },

  applyHomeLayout(
    composerRect: WechatMiniprogram.BoundingClientRectCallbackResult,
    recentRect: WechatMiniprogram.BoundingClientRectCallbackResult,
    navTop: number,
  ) {
      const systemInfo = wx.getSystemInfoSync()
      const bottomGap = systemInfo.windowWidth * 16 / 750
      const remainingHeight = navTop - bottomGap - recentRect.bottom

      if (remainingHeight <= 0) {
        this.setData({ layoutScrollable: true })
        return
      }

      this.setData({
        composerMinHeight: Math.round(composerRect.height + remainingHeight),
        layoutScrollable: false,
      })
  },

  handleDraftInput(event: WechatMiniprogram.Input) {
    this.setData({ draft: event.detail.value })
    if (layoutTimer !== undefined) {
      clearTimeout(layoutTimer)
    }
    layoutTimer = setTimeout(() => this.scheduleHomeLayout(), 80)
  },

  selectType(event: WechatMiniprogram.BaseEvent) {
    const { type } = event.currentTarget.dataset as { type: EntryType }
    const option = entryTypeOptions.find((item) => item.key === type) || entryTypeOptions[0]
    this.setData({ selectedType: type, placeholder: option.placeholder }, () => {
      this.scheduleHomeLayout()
    })
  },

  selectMediaCategory(event: WechatMiniprogram.BaseEvent) {
    const { category } = event.currentTarget.dataset as { category: MediaCategory }
    const mediaStatusOptions = getMediaStatusOptions(category)
    const selectedMediaStatus = mediaStatusOptions.some((option) => option.key === this.data.selectedMediaStatus)
      ? this.data.selectedMediaStatus
      : mediaStatusOptions[mediaStatusOptions.length - 1].key
    this.setData({ selectedMediaCategory: category, mediaStatusOptions, selectedMediaStatus })
  },

  selectMediaStatus(event: WechatMiniprogram.BaseEvent) {
    const { status } = event.currentTarget.dataset as { status: EntryStatus }
    this.setData({ selectedMediaStatus: status })
  },

  saveQuickEntry() {
    const content = this.data.draft.trim()
    if (!content) {
      wx.showToast({ title: '先写点内容', icon: 'none' })
      return
    }

    const { date, time } = getCurrentDateTime()
    const recordedAt = `${date} ${time}`
    const timeMetadata = formatTimeMetadata(recordedAt)
    const type = this.data.selectedType
    const mediaCategory = getMediaCategory(this.data.selectedMediaCategory)
    const mediaStatus = this.data.selectedMediaStatus
    const entry: PrototypeEntry = {
      id: `entry-${Date.now()}`,
      type,
      typeLabel: type === 'note' ? '随记' : type === 'todo' ? '待办' : '书影音',
      mark: type === 'note' ? '记' : type === 'todo' ? '待' : mediaCategory.mark,
      content,
      detail: '',
      mediaCategory: mediaCategory.key,
      mediaCategoryLabel: type === 'media' ? mediaCategory.label : '',
      status: type === 'media' ? mediaStatus : 'active',
      statusLabel: type === 'note'
        ? '随记'
        : type === 'todo' ? '待完成' : getMediaStatusLabel(mediaCategory.key, mediaStatus),
      currentProgress: 0,
      totalProgress: 0,
      progressText: '',
      completed: type === 'media' && mediaStatus === 'completed',
      recordedAt,
      ...timeMetadata,
    }

    savePrototypeEntry(entry)
    this.setData({ draft: '' })
    this.loadEntries()
    wx.showToast({ title: '已记录', icon: 'success' })
  },

  openMoreOptions() {
    wx.setStorageSync(COMPOSER_DRAFT_KEY, {
      content: this.data.draft,
      type: this.data.selectedType,
      mediaCategory: this.data.selectedMediaCategory,
      mediaStatus: this.data.selectedMediaStatus,
    })
    wx.navigateTo({ url: `/pages/add/add?type=${this.data.selectedType}` })
  },

  openAll() {
    wx.redirectTo({ url: '/pages/records/records' })
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

  toggleTodo(event: WechatMiniprogram.BaseEvent) {
    const { id } = event.currentTarget.dataset as { id: string }
    const entry = getPrototypeEntry(id)
    if (!entry) {
      return
    }
    const completed = !entry.completed
    savePrototypeEntry({
      ...entry,
      completed,
      status: completed ? 'completed' : 'active',
      statusLabel: completed ? '已完成' : '待完成',
    })
    this.loadEntries(false)
  },

  increaseProgress(event: WechatMiniprogram.BaseEvent) {
    const { id } = event.currentTarget.dataset as { id: string }
    const entry = getPrototypeEntry(id)
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
    savePrototypeEntry({
      ...entry,
      currentProgress,
      progressText: entry.totalProgress > 0
        ? `${currentProgress} / ${entry.totalProgress} 集`
        : `第 ${currentProgress} 集`,
    })
    this.loadEntries(false)
    wx.showToast({ title: '进度已更新', icon: 'success' })
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
    this.loadEntries(false)
    wx.showToast({ title: '进度已更新', icon: 'success' })
  },
})
