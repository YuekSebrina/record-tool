import {
  EntryStatus,
  EntryType,
  entryTypeOptions,
  formatTimeMetadata,
  getCurrentDateTime,
  getMediaCategory,
  getMediaStatusLabel,
  getMediaStatusOptions,
  getPrototypeEntry,
  mediaCategoryOptions,
  MediaCategory,
  PrototypeEntry,
  savePrototypeEntry,
} from '../../utils/prototype-data'

interface ComposerDraft {
  content: string
  type: EntryType
  mediaCategory: MediaCategory
  mediaStatus: EntryStatus
}

const COMPOSER_DRAFT_KEY = 'phase-one-composer-draft'
const COMPOSER_SAVED_KEY = 'phase-one-composer-saved'

function isEntryType(value: string | undefined): value is EntryType {
  return value === 'note' || value === 'todo' || value === 'media'
}

Page({
  data: {
    typeOptions: entryTypeOptions,
    mediaCategories: mediaCategoryOptions,
    mediaStatusOptions: getMediaStatusOptions('anime'),
    selectedType: 'note' as EntryType,
    selectedMediaCategory: 'anime' as MediaCategory,
    selectedMediaStatus: 'active' as EntryStatus,
    content: '',
    detail: '',
    currentProgress: 0,
    totalProgress: 0,
    todoCompleted: false,
    isEditing: false,
    currentEntryId: '',
    fromComposer: false,
    ...getCurrentDateTime(),
  },

  onLoad(options: Record<string, string | undefined>) {
    if (options.id) {
      const entry = getPrototypeEntry(options.id)
      if (entry) {
        const [date = this.data.date, time = this.data.time] = entry.recordedAt.split(' ')
        this.setData({
          selectedType: entry.type,
          selectedMediaCategory: entry.mediaCategory,
          selectedMediaStatus: entry.status,
          mediaStatusOptions: getMediaStatusOptions(entry.mediaCategory),
          content: entry.content,
          detail: entry.detail,
          currentProgress: entry.currentProgress,
          totalProgress: entry.totalProgress,
          todoCompleted: entry.completed,
          isEditing: true,
          currentEntryId: entry.id,
          date,
          time,
        })
        return
      }
    }

    const draft = wx.getStorageSync<ComposerDraft | ''>(COMPOSER_DRAFT_KEY)
    if (draft && typeof draft === 'object') {
      const mediaStatusOptions = getMediaStatusOptions(draft.mediaCategory)
      this.setData({
        selectedType: draft.type,
        selectedMediaCategory: draft.mediaCategory,
        selectedMediaStatus: mediaStatusOptions.some((option) => option.key === draft.mediaStatus)
          ? draft.mediaStatus
          : mediaStatusOptions[0].key,
        mediaStatusOptions,
        content: draft.content,
        fromComposer: true,
        ...getCurrentDateTime(),
      })
      wx.removeStorageSync(COMPOSER_DRAFT_KEY)
      return
    }

    this.setData({
      selectedType: isEntryType(options.type) ? options.type : 'note',
      ...getCurrentDateTime(),
    })
  },

  selectType(event: WechatMiniprogram.BaseEvent) {
    const { type } = event.currentTarget.dataset as { type: EntryType }
    this.setData({ selectedType: type })
  },

  handleContentInput(event: WechatMiniprogram.Input) {
    this.setData({ content: event.detail.value })
  },

  handleDetailInput(event: WechatMiniprogram.Input) {
    this.setData({ detail: event.detail.value })
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

  handleCurrentProgress(event: WechatMiniprogram.Input) {
    this.setData({ currentProgress: Math.max(0, Number(event.detail.value) || 0) })
  },

  handleTotalProgress(event: WechatMiniprogram.Input) {
    this.setData({ totalProgress: Math.max(0, Number(event.detail.value) || 0) })
  },

  toggleTodoCompleted() {
    this.setData({ todoCompleted: !this.data.todoCompleted })
  },

  selectDate(event: WechatMiniprogram.PickerChange) {
    this.setData({ date: String(event.detail.value) })
  },

  selectTime(event: WechatMiniprogram.PickerChange) {
    this.setData({ time: String(event.detail.value) })
  },

  saveEntry() {
    const content = this.data.content.trim()
    if (!content) {
      wx.showToast({ title: '先写点内容', icon: 'none' })
      return
    }

    const type = this.data.selectedType
    const mediaCategory = getMediaCategory(this.data.selectedMediaCategory)
    const mediaStatus = this.data.selectedMediaStatus
    const completed = type === 'todo'
      ? this.data.todoCompleted
      : type === 'media' && mediaStatus === 'completed'
    const status: EntryStatus = type === 'todo'
      ? completed ? 'completed' : 'active'
      : type === 'media' ? mediaStatus : 'active'
    const supportsProgress = type === 'media'
      && (mediaCategory.key === 'anime' || mediaCategory.key === 'kdrama')
    const totalProgress = supportsProgress ? this.data.totalProgress : 0
    const currentProgress = supportsProgress && status === 'active'
      ? Math.min(this.data.currentProgress, totalProgress || Number.MAX_SAFE_INTEGER)
      : supportsProgress && status === 'completed' && totalProgress > 0 ? totalProgress : 0
    const progressText = supportsProgress && currentProgress > 0
      ? totalProgress > 0 ? `${currentProgress} / ${totalProgress} 集` : `第 ${currentProgress} 集`
      : ''
    const recordedAt = `${this.data.date} ${this.data.time}`
    const entry: PrototypeEntry = {
      id: this.data.currentEntryId || `entry-${Date.now()}`,
      type,
      typeLabel: type === 'note' ? '随记' : type === 'todo' ? '待办' : '书影音',
      mark: type === 'note' ? '记' : type === 'todo' ? '待' : mediaCategory.mark,
      content,
      detail: this.data.detail.trim(),
      mediaCategory: mediaCategory.key,
      mediaCategoryLabel: type === 'media' ? mediaCategory.label : '',
      status,
      statusLabel: type === 'note'
        ? '随记'
        : type === 'todo'
          ? completed ? '已完成' : '待完成'
          : getMediaStatusLabel(mediaCategory.key, status),
      currentProgress,
      totalProgress,
      progressText,
      completed,
      recordedAt,
      ...formatTimeMetadata(recordedAt),
    }

    savePrototypeEntry(entry)
    if (this.data.fromComposer) {
      wx.setStorageSync(COMPOSER_SAVED_KEY, true)
    }
    wx.showToast({ title: '已保存', icon: 'success' })
    setTimeout(() => {
      if (this.data.isEditing) {
        wx.navigateBack()
        return
      }
      wx.redirectTo({ url: `/pages/detail/detail?id=${entry.id}` })
    }, 400)
  },
})
