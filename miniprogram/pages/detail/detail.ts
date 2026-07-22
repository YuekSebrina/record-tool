import {
  deletePrototypeEntry,
  getMediaStatusLabel,
  getPrototypeEntries,
  getPrototypeEntry,
  PrototypeEntry,
  savePrototypeEntry,
} from '../../utils/prototype-data'

const emptyEntry: PrototypeEntry = {
  id: '',
  type: 'note',
  typeLabel: '随记',
  mark: '记',
  content: '',
  detail: '',
  mediaCategory: 'book',
  mediaCategoryLabel: '',
  status: 'active',
  statusLabel: '随记',
  currentProgress: 0,
  totalProgress: 0,
  progressText: '',
  completed: false,
  recordedAt: '',
  timeLabel: '',
  dateGroup: '',
}

Page({
  data: {
    entry: getPrototypeEntries()[0] || emptyEntry,
    currentEntryId: '',
    actionMenuOpen: false,
  },

  onLoad(options: Record<string, string | undefined>) {
    const firstEntry = getPrototypeEntries()[0]
    this.setData({ currentEntryId: options.id || (firstEntry ? firstEntry.id : '') })
  },

  onShow() {
    const entry = getPrototypeEntry(this.data.currentEntryId)
    if (!entry) {
      wx.reLaunch({ url: '/pages/index/index' })
      return
    }
    this.setData({ entry })
  },

  editEntry() {
    this.setData({ actionMenuOpen: false })
    wx.navigateTo({ url: `/pages/add/add?id=${this.data.entry.id}` })
  },

  toggleActionMenu() {
    this.setData({ actionMenuOpen: !this.data.actionMenuOpen })
  },

  toggleTodo() {
    const entry = this.data.entry
    const completed = !entry.completed
    const updatedEntry: PrototypeEntry = {
      ...entry,
      completed,
      status: completed ? 'completed' : 'active',
      statusLabel: completed ? '已完成' : '待完成',
    }
    savePrototypeEntry(updatedEntry)
    this.setData({ entry: updatedEntry, actionMenuOpen: false })
  },

  increaseProgress() {
    const entry = this.data.entry
    if (entry.mediaCategory !== 'anime' && entry.mediaCategory !== 'kdrama') {
      this.setData({ actionMenuOpen: false })
      return
    }
    if (entry.totalProgress > 0 && entry.currentProgress >= entry.totalProgress) {
      this.setData({ actionMenuOpen: false })
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
    this.setData({ entry: updatedEntry, actionMenuOpen: false })
    wx.showToast({ title: '进度已更新', icon: 'success' })
  },

  completeMedia() {
    const entry = this.data.entry
    const updatedEntry: PrototypeEntry = {
      ...entry,
      status: 'completed',
      statusLabel: getMediaStatusLabel(entry.mediaCategory, 'completed'),
      completed: true,
      currentProgress: entry.totalProgress || entry.currentProgress,
      progressText: entry.totalProgress > 0 ? `${entry.totalProgress} / ${entry.totalProgress} 集` : entry.progressText,
    }
    savePrototypeEntry(updatedEntry)
    this.setData({ entry: updatedEntry, actionMenuOpen: false })
  },

  confirmDelete() {
    this.setData({ actionMenuOpen: false })
    wx.showModal({
      title: '删除这条记录？',
      content: '删除后无法恢复。',
      confirmText: '删除',
      confirmColor: '#b3483f',
      success: (result) => {
        if (!result.confirm) {
          return
        }
        deletePrototypeEntry(this.data.entry.id)
        if (getCurrentPages().length > 1) {
          wx.navigateBack()
        } else {
          wx.reLaunch({ url: '/pages/index/index' })
        }
      },
    })
  },
})
