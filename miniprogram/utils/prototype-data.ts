export type EntryType = 'note' | 'todo' | 'media'
export type EntryStatus = 'active' | 'planned' | 'completed'
export type MediaCategory = 'book' | 'anime' | 'movie' | 'kdrama'

export interface EntryTypeOption {
  key: EntryType
  label: string
  placeholder: string
}

export interface MediaCategoryOption {
  key: MediaCategory
  label: string
  mark: string
}

export interface MediaStatusOption {
  key: EntryStatus
  label: string
}

interface LegacyPrototypeRecord {
  id: string
  title: string
  category: MediaCategory
  categoryLabel: string
  categoryMark: string
  status: 'planned' | 'in-progress' | 'completed'
  statusLabel: string
  currentProgress: number
  totalProgress: number
  progressText: string
  recordedAt: string
  note: string
}

export interface PrototypeEntry {
  id: string
  type: EntryType
  typeLabel: string
  mark: string
  content: string
  detail: string
  mediaCategory: MediaCategory
  mediaCategoryLabel: string
  status: EntryStatus
  statusLabel: string
  currentProgress: number
  totalProgress: number
  progressText: string
  completed: boolean
  recordedAt: string
  timeLabel: string
  dateGroup: string
}

export const entryTypeOptions: EntryTypeOption[] = [
  { key: 'note', label: '随记', placeholder: '写下一段话...' },
  { key: 'todo', label: '待办', placeholder: '添加一件要做的事...' },
  { key: 'media', label: '书影音', placeholder: '输入书名、电影或剧名...' },
]

export const mediaCategoryOptions: MediaCategoryOption[] = [
  { key: 'book', label: '书籍', mark: '书' },
  { key: 'anime', label: '动漫', mark: '漫' },
  { key: 'movie', label: '电影', mark: '影' },
  { key: 'kdrama', label: '韩剧', mark: '韩' },
]

const STORAGE_KEY = 'phase-one-simple-entries'
const DELETED_STORAGE_KEY = 'phase-one-deleted-entry-ids'
const LEGACY_STORAGE_KEY = 'phase-one-prototype-record'
const MIGRATION_DONE_KEY = 'phase-one-legacy-migration-done'

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function toDateValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function makeRelativeDate(dayOffset: number, hour: number, minute: number): string {
  const date = new Date()
  date.setDate(date.getDate() + dayOffset)
  return `${toDateValue(date)} ${pad(hour)}:${pad(minute)}`
}

export function formatTimeMetadata(recordedAt: string): {
  timeLabel: string
  dateGroup: string
} {
  const [date = '', time = ''] = recordedAt.split(' ')
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  if (date === toDateValue(today)) {
    return { timeLabel: `今天 ${time}`, dateGroup: '今天' }
  }
  if (date === toDateValue(yesterday)) {
    return { timeLabel: `昨天 ${time}`, dateGroup: '昨天' }
  }

  const [year = '', month = '', day = ''] = date.split('-')
  const dateLabel = year === String(today.getFullYear())
    ? `${month}月${day}日`
    : `${year}年${month}月${day}日`
  return { timeLabel: `${dateLabel} ${time}`, dateGroup: '更早' }
}

export function getCurrentDateTime(): { date: string; time: string } {
  const now = new Date()
  return {
    date: toDateValue(now),
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
  }
}

export function getMediaCategory(category: MediaCategory): MediaCategoryOption {
  return mediaCategoryOptions.find((item) => item.key === category) || mediaCategoryOptions[0]
}

export function getMediaStatusOptions(category: MediaCategory): MediaStatusOption[] {
  if (category === 'book') {
    return [
      { key: 'planned', label: '想读' },
      { key: 'active', label: '在读' },
      { key: 'completed', label: '已读' },
    ]
  }
  if (category === 'movie') {
    return [
      { key: 'planned', label: '想看' },
      { key: 'completed', label: '已看' },
    ]
  }
  return [
    { key: 'planned', label: '想看' },
    { key: 'active', label: '在看' },
    { key: 'completed', label: '已完成' },
  ]
}

export function getMediaStatusLabel(category: MediaCategory, status: EntryStatus): string {
  if (status === 'planned') {
    return category === 'book' ? '想读' : '想看'
  }
  if (status === 'completed') {
    if (category === 'book') {
      return '已读'
    }
    return category === 'movie' ? '已看' : '已完成'
  }
  return category === 'book' ? '在读' : '在看'
}

function getMigratedEntries(): PrototypeEntry[] {
  const legacyValue = wx.getStorageSync<LegacyPrototypeRecord | LegacyPrototypeRecord[]>(LEGACY_STORAGE_KEY)
  const legacyRecords = Array.isArray(legacyValue)
    ? legacyValue
    : legacyValue && typeof legacyValue === 'object' ? [legacyValue] : []

  return legacyRecords.map((record) => {
    const status: EntryStatus = record.status === 'in-progress' ? 'active' : record.status
    const supportsProgress = record.category === 'anime' || record.category === 'kdrama'
    const totalProgress = supportsProgress && status !== 'planned' ? record.totalProgress : 0
    const currentProgress = supportsProgress && status === 'active'
      ? Math.min(record.currentProgress, totalProgress || Number.MAX_SAFE_INTEGER)
      : supportsProgress && status === 'completed' && totalProgress > 0 ? totalProgress : 0
    const progressText = currentProgress > 0
      ? totalProgress > 0 ? `${currentProgress} / ${totalProgress} 集` : `第 ${currentProgress} 集`
      : ''
    return {
      id: `legacy-${record.id}`,
      type: 'media',
      typeLabel: '书影音',
      mark: record.categoryMark,
      content: record.title,
      detail: record.note || '',
      mediaCategory: record.category,
      mediaCategoryLabel: record.categoryLabel,
      status,
      statusLabel: getMediaStatusLabel(record.category, status),
      currentProgress,
      totalProgress,
      progressText,
      completed: status === 'completed',
      recordedAt: record.recordedAt,
      ...formatTimeMetadata(record.recordedAt),
    }
  })
}

const sampleEntries: PrototypeEntry[] = [
  {
    id: 'sample-note',
    type: 'note',
    typeLabel: '随记',
    mark: '记',
    content: '今天路过一家很安静的小店，窗边有阳光，也有刚烤好的面包香。',
    detail: '',
    mediaCategory: 'book',
    mediaCategoryLabel: '',
    status: 'active',
    statusLabel: '随记',
    currentProgress: 0,
    totalProgress: 0,
    progressText: '',
    completed: false,
    recordedAt: makeRelativeDate(0, 9, 20),
    timeLabel: '',
    dateGroup: '',
  },
  {
    id: 'sample-todo',
    type: 'todo',
    typeLabel: '待办',
    mark: '待',
    content: '整理本周要做的事情',
    detail: '今天结束前',
    mediaCategory: 'book',
    mediaCategoryLabel: '',
    status: 'active',
    statusLabel: '待完成',
    currentProgress: 0,
    totalProgress: 0,
    progressText: '',
    completed: false,
    recordedAt: makeRelativeDate(0, 8, 40),
    timeLabel: '',
    dateGroup: '',
  },
  {
    id: 'sample-anime',
    type: 'media',
    typeLabel: '书影音',
    mark: '漫',
    content: '葬送的芙莉莲',
    detail: '',
    mediaCategory: 'anime',
    mediaCategoryLabel: '动漫',
    status: 'active',
    statusLabel: '进行中',
    currentProgress: 18,
    totalProgress: 28,
    progressText: '18 / 28 集',
    completed: false,
    recordedAt: makeRelativeDate(-1, 21, 10),
    timeLabel: '',
    dateGroup: '',
  },
  {
    id: 'sample-completed-todo',
    type: 'todo',
    typeLabel: '待办',
    mark: '待',
    content: '给妈妈回电话',
    detail: '',
    mediaCategory: 'book',
    mediaCategoryLabel: '',
    status: 'completed',
    statusLabel: '已完成',
    currentProgress: 0,
    totalProgress: 0,
    progressText: '',
    completed: true,
    recordedAt: makeRelativeDate(-1, 18, 30),
    timeLabel: '',
    dateGroup: '',
  },
]

export function getPrototypeEntries(): PrototypeEntry[] {
  const storedEntries = wx.getStorageSync<PrototypeEntry[]>(STORAGE_KEY)
  let savedEntries = Array.isArray(storedEntries) ? storedEntries : []
  const deletedIds = wx.getStorageSync<string[]>(DELETED_STORAGE_KEY)
  const hiddenIds = Array.isArray(deletedIds) ? deletedIds : []
  const migrationDone = wx.getStorageSync<boolean>(MIGRATION_DONE_KEY)
  if (!migrationDone) {
    const migratedEntries = getMigratedEntries()
    const existingIds = new Set(savedEntries.map((entry) => entry.id))
    savedEntries = [
      ...savedEntries,
      ...migratedEntries.filter((entry) => !existingIds.has(entry.id) && !hiddenIds.includes(entry.id)),
    ]
    wx.setStorageSync(STORAGE_KEY, savedEntries)
    wx.setStorageSync(MIGRATION_DONE_KEY, true)
  }
  const entries = [
    ...savedEntries
      .filter((entry) => !hiddenIds.includes(entry.id))
      .map((entry) => ({ ...entry })),
    ...sampleEntries
      .filter((entry) => !hiddenIds.includes(entry.id))
      .filter((entry) => !Array.isArray(savedEntries)
        || !savedEntries.some((savedEntry) => savedEntry.id === entry.id))
      .map((entry) => ({ ...entry })),
  ]

  return entries
    .map((entry) => ({
      ...entry,
      ...formatTimeMetadata(entry.recordedAt),
    }))
    .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt))
}

export function getPrototypeEntry(id: string): PrototypeEntry | undefined {
  return getPrototypeEntries().find((entry) => entry.id === id)
}

export function savePrototypeEntry(entry: PrototypeEntry): void {
  const savedEntries = wx.getStorageSync<PrototypeEntry[]>(STORAGE_KEY)
  const currentEntries = Array.isArray(savedEntries) ? savedEntries : []
  wx.setStorageSync(STORAGE_KEY, [
    entry,
    ...currentEntries.filter((savedEntry) => savedEntry.id !== entry.id),
  ])
  const deletedIds = wx.getStorageSync<string[]>(DELETED_STORAGE_KEY)
  if (Array.isArray(deletedIds) && deletedIds.includes(entry.id)) {
    wx.setStorageSync(DELETED_STORAGE_KEY, deletedIds.filter((id) => id !== entry.id))
  }
}

export function deletePrototypeEntry(id: string): void {
  const savedEntries = wx.getStorageSync<PrototypeEntry[]>(STORAGE_KEY)
  const currentEntries = Array.isArray(savedEntries) ? savedEntries : []
  wx.setStorageSync(STORAGE_KEY, currentEntries.filter((entry) => entry.id !== id))
  const deletedIds = wx.getStorageSync<string[]>(DELETED_STORAGE_KEY)
  const currentDeletedIds = Array.isArray(deletedIds) ? deletedIds : []
  wx.setStorageSync(DELETED_STORAGE_KEY, Array.from(new Set([...currentDeletedIds, id])))
}
