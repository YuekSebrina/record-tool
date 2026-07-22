export type CategoryKey = 'book' | 'anime' | 'movie' | 'kdrama'
export type StatusKey = 'planned' | 'in-progress' | 'completed'

export interface CategoryMeta {
  key: CategoryKey
  label: string
  mark: string
  helper: string
  accentClass: string
}

export interface PrototypeRecord {
  id: string
  editionIndex: string
  title: string
  category: CategoryKey
  categoryLabel: string
  categoryMark: string
  status: StatusKey
  statusLabel: string
  currentProgress: number
  totalProgress: number
  progressText: string
  progressPercent: number
  recordedAt: string
  timeLabel: string
  dateGroup: string
  note: string
  accentClass: string
}

export const categoryMetas: CategoryMeta[] = [
  {
    key: 'book',
    label: '书籍',
    mark: '书',
    helper: '想读、在读与已读',
    accentClass: 'accent--book',
  },
  {
    key: 'anime',
    label: '动漫',
    mark: '漫',
    helper: '追番与集数进度',
    accentClass: 'accent--anime',
  },
  {
    key: 'movie',
    label: '电影',
    mark: '影',
    helper: '想看与已看',
    accentClass: 'accent--movie',
  },
  {
    key: 'kdrama',
    label: '韩剧',
    mark: '韩',
    helper: '在看与完成进度',
    accentClass: 'accent--kdrama',
  },
]

const staticRecords: PrototypeRecord[] = [
  {
    id: 'frieren',
    editionIndex: '01',
    title: '葬送的芙莉莲',
    category: 'anime',
    categoryLabel: '动漫',
    categoryMark: '漫',
    status: 'in-progress',
    statusLabel: '在看',
    currentProgress: 18,
    totalProgress: 28,
    progressText: '看到 18 / 28 集',
    progressPercent: 64,
    recordedAt: '2026-07-22 21:10',
    timeLabel: '今天 21:10',
    dateGroup: '今天',
    note: '勇者一行结束冒险之后，精灵魔法使重新理解时间与相遇。',
    accentClass: 'accent--anime',
  },
  {
    id: 'when-life-gives-you-tangerines',
    editionIndex: '02',
    title: '苦尽柑来遇见你',
    category: 'kdrama',
    categoryLabel: '韩剧',
    categoryMark: '韩',
    status: 'in-progress',
    statusLabel: '在看',
    currentProgress: 8,
    totalProgress: 16,
    progressText: '看到 8 / 16 集',
    progressPercent: 50,
    recordedAt: '2026-07-22 19:35',
    timeLabel: '今天 19:35',
    dateGroup: '今天',
    note: '把漫长人生折进四季，记下爱顺与宽植共同走过的年月。',
    accentClass: 'accent--kdrama',
  },
  {
    id: 'ren-jian-cao-mu',
    editionIndex: '03',
    title: '人间草木',
    category: 'book',
    categoryLabel: '书籍',
    categoryMark: '书',
    status: 'completed',
    statusLabel: '已读',
    currentProgress: 0,
    totalProgress: 0,
    progressText: '已读完',
    progressPercent: 100,
    recordedAt: '2026-07-21 22:40',
    timeLabel: '昨天 22:40',
    dateGroup: '昨天',
    note: '草木虫鱼皆有性情，平常日子也值得郑重收藏。',
    accentClass: 'accent--book',
  },
  {
    id: 'in-the-mood-for-love',
    editionIndex: '04',
    title: '花样年华',
    category: 'movie',
    categoryLabel: '电影',
    categoryMark: '影',
    status: 'completed',
    statusLabel: '已看',
    currentProgress: 0,
    totalProgress: 0,
    progressText: '已看完',
    progressPercent: 100,
    recordedAt: '2026-07-19 23:18',
    timeLabel: '07月19日 23:18',
    dateGroup: '更早',
    note: '那些没有说出口的话，被留在走廊、雨夜和旧时光里。',
    accentClass: 'accent--movie',
  },
]

const PROTOTYPE_STORAGE_KEY = 'phase-one-prototype-record'

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function toDateValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
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

export function getCategoryMeta(category: CategoryKey): CategoryMeta {
  return categoryMetas.find((item) => item.key === category) || categoryMetas[0]
}

export function getStatusLabel(category: CategoryKey, status: StatusKey): string {
  if (status === 'planned') {
    return category === 'book' ? '想读' : '想看'
  }
  if (status === 'in-progress') {
    return category === 'book' ? '在读' : '在看'
  }
  if (category === 'book') {
    return '已读'
  }
  if (category === 'movie') {
    return '已看'
  }
  return '已完成'
}

export function getPrototypeRecords(): PrototypeRecord[] {
  const savedRecords = wx.getStorageSync<PrototypeRecord[]>(PROTOTYPE_STORAGE_KEY)
  const records = [
    ...(Array.isArray(savedRecords) ? savedRecords : []).map((record) => ({ ...record })),
    ...staticRecords
      .filter((record) => !Array.isArray(savedRecords)
        || !savedRecords.some((savedRecord) => savedRecord.id === record.id))
      .map((record) => ({ ...record })),
  ]

  return records
    .map((record) => ({
      ...record,
      ...formatTimeMetadata(record.recordedAt),
    }))
    .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt))
}

export function getPrototypeRecord(id: string): PrototypeRecord | undefined {
  return getPrototypeRecords().find((record) => record.id === id)
}

export function savePrototypeRecord(record: PrototypeRecord): void {
  const savedRecords = wx.getStorageSync<PrototypeRecord[]>(PROTOTYPE_STORAGE_KEY)
  const currentRecords = Array.isArray(savedRecords) ? savedRecords : []
  wx.setStorageSync(PROTOTYPE_STORAGE_KEY, [
    record,
    ...currentRecords.filter((savedRecord) => savedRecord.id !== record.id),
  ])
}
