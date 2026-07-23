export type FavoriteCategory = 'book' | 'anime' | 'movie' | 'series'
export type FavoriteStatus = 'planned' | 'active' | 'completed'

export interface CategoryOption {
  key: FavoriteCategory
  label: string
  mark: string
  description: string
}

export interface CatalogItem {
  id: string
  category: FavoriteCategory
  title: string
  subtitle: string
  cover: string
  year: string
  author: string
  episode: string
  rating: string
  description: string
  sourceType: string
  sourceUrl: string
}

export interface FavoriteItem extends CatalogItem {
  favoriteId: string
  savedAt: number
  userRating: number
  currentProgress: number
  totalProgress: number
  progressPercentage: number
  status: FavoriteStatus
}

export interface CatalogDetail {
  description: string
  rating: string
  genres: string[]
  creators: string[]
  sourceUrl: string
}

interface ApiResponse<T> {
  code: number
  data: T
  errorMsg?: string
}

const CLOUD_RUN_ENV = 'prod-d8gf33lii77ef34ef'
const CLOUD_RUN_SERVICE = 'flask-tddl'
const FAVORITES_STORAGE_KEY = 'favorite-catalog-items-v1'
const LEGACY_ENTRIES_STORAGE_KEY = 'phase-one-simple-entries'
const EARLIEST_MEDIA_STORAGE_KEY = 'phase-one-prototype-record'
const LEGACY_DELETED_STORAGE_KEY = 'phase-one-deleted-entry-ids'
const LEGACY_FAVORITES_MIGRATION_V1_KEY = 'favorite-catalog-legacy-migrated-v1'
const LEGACY_FAVORITES_MIGRATION_KEY = 'favorite-catalog-legacy-migrated-v2'
const DELETED_FAVORITES_STORAGE_KEY = 'favorite-catalog-deleted-ids-v1'
const IMAGE_CACHE_STORAGE_KEY = 'douban-image-cache-v1'
const MAX_CACHED_IMAGES = 60
let pinnedCoverPaths = new Set<string>()
let warmingPromise: Promise<void> | null = null

export const categoryOptions: CategoryOption[] = [
  { key: 'book', label: '书籍', mark: '书', description: '小说、传记与非虚构' },
  { key: 'anime', label: '动漫', mark: '漫', description: '动画电影与系列动画' },
  { key: 'movie', label: '电影', mark: '影', description: '长片、短片与纪录片' },
  { key: 'series', label: '剧集', mark: '剧', description: '电视剧与网络剧' },
]

function callContainer<T>(
  path: string,
  responseType: 'text' | 'arraybuffer' = 'text',
  timeout = 30000,
) {
  return wx.cloud.callContainer<T>({
    config: { env: CLOUD_RUN_ENV },
    path,
    header: { 'X-WX-SERVICE': CLOUD_RUN_SERVICE },
    method: 'GET',
    timeout,
    dataType: responseType === 'text' ? 'json' : undefined,
    responseType,
  })
}

export async function searchCatalog(keyword: string, category: FavoriteCategory): Promise<CatalogItem[]> {
  let response: CloudContainerResult<ApiResponse<CatalogItem[]>>
  try {
    response = await callContainer<ApiResponse<CatalogItem[]>>(
      `/api/search?q=${encodeURIComponent(keyword)}&type=${category}`,
    )
  } catch (error) {
    const message = getRequestErrorMessage(error)
    if (message.toLowerCase().includes('timeout')) {
      throw new Error('搜索服务启动较慢，请重新搜索')
    }
    throw new Error('无法连接搜索服务，请稍后重试')
  }
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(`搜索服务返回 HTTP ${response.statusCode}`)
  }
  if (!response.data || response.data.code !== 0 || !Array.isArray(response.data.data)) {
    throw new Error(response.data && response.data.errorMsg ? response.data.errorMsg : '搜索服务返回了无效数据')
  }
  return response.data.data
}

export async function getTrendingCatalog(): Promise<CatalogItem[]> {
  let response: CloudContainerResult<ApiResponse<CatalogItem[]>>
  try {
    response = await callContainer<ApiResponse<CatalogItem[]>>('/api/trending')
  } catch (_error) {
    throw new Error('暂时无法获取近期热门')
  }
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error('暂时无法获取近期热门')
  }
  if (!response.data || response.data.code !== 0 || !Array.isArray(response.data.data)) {
    throw new Error(response.data && response.data.errorMsg ? response.data.errorMsg : '热门内容数据无效')
  }
  const categories = new Set(response.data.data.map((item) => item.category))
  if (response.data.data.length !== categoryOptions.length
    || categoryOptions.some((item) => !categories.has(item.key))) {
    throw new Error('热门内容数据不完整')
  }
  return response.data.data
}

export async function getCatalogDetail(
  id: string,
  category: FavoriteCategory,
): Promise<CatalogDetail> {
  let response: CloudContainerResult<ApiResponse<CatalogDetail>>
  try {
    response = await callContainer<ApiResponse<CatalogDetail>>(
      `/api/detail?id=${encodeURIComponent(id)}&type=${category}`,
    )
  } catch (error) {
    const message = getRequestErrorMessage(error)
    if (message.toLowerCase().includes('timeout')) {
      throw new Error('详情加载较慢，请稍后重试')
    }
    throw new Error('暂时无法获取详情')
  }
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error('暂时无法获取详情')
  }
  if (!response.data || response.data.code !== 0 || !response.data.data) {
    throw new Error(response.data && response.data.errorMsg ? response.data.errorMsg : '详情数据无效')
  }
  return response.data.data
}

function getRequestErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (error && typeof error === 'object' && 'errMsg' in error) {
    return String((error as { errMsg: unknown }).errMsg)
  }
  return String(error || '')
}

export function warmCatalogService(): Promise<void> {
  if (warmingPromise) {
    return warmingPromise
  }
  warmingPromise = callContainer<ApiResponse<{ status: string }>>('/api/health')
    .then(() => {})
    .catch(() => {})
    .finally(() => {
      warmingPromise = null
    })
  return warmingPromise
}

function hashString(value: string): string {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

function fileExists(path: string): Promise<boolean> {
  return new Promise((resolve) => {
    wx.getFileSystemManager().access({
      path,
      success: () => resolve(true),
      fail: () => resolve(false),
    })
  })
}

function writeFile(path: string, data: ArrayBuffer): Promise<void> {
  return new Promise((resolve, reject) => {
    wx.getFileSystemManager().writeFile({
      filePath: path,
      data,
      success: () => resolve(),
      fail: reject,
    })
  })
}

function deleteFile(path: string): void {
  wx.getFileSystemManager().unlink({ filePath: path, fail: () => {} })
}

function touchImageCache(path: string): void {
  const value = wx.getStorageSync<string[]>(IMAGE_CACHE_STORAGE_KEY)
  const paths = Array.isArray(value) ? value.filter((item) => item !== path) : []
  const retainedPaths: string[] = []
  const expiredPaths: string[] = []
  const orderedPaths = [path, ...paths]
  orderedPaths.forEach((item) => {
    if (retainedPaths.length < MAX_CACHED_IMAGES || pinnedCoverPaths.has(item)) {
      retainedPaths.push(item)
    } else {
      expiredPaths.push(item)
    }
  })
  expiredPaths.forEach(deleteFile)
  wx.setStorageSync(IMAGE_CACHE_STORAGE_KEY, retainedPaths)
}

function isValidCachedImage(path: string): Promise<boolean> {
  return new Promise((resolve) => {
    wx.getImageInfo({
      src: path,
      success: () => resolve(true),
      fail: () => resolve(false),
    })
  })
}

function getCoverCachePath(cover: string): string {
  return `${wx.env.USER_DATA_PATH}/douban-${hashString(cover)}.jpg`
}

export function pinDisplayCovers(covers: string[]): void {
  pinnedCoverPaths = new Set(covers.filter(Boolean).map(getCoverCachePath))
}

export async function getDisplayCover(cover: string): Promise<string> {
  if (!cover) {
    return ''
  }
  const filePath = getCoverCachePath(cover)
  if (await fileExists(filePath) && await isValidCachedImage(filePath)) {
    touchImageCache(filePath)
    return filePath
  }
  deleteFile(filePath)
  const response = await callContainer<ArrayBuffer>(
    `/api/image?url=${encodeURIComponent(cover)}`,
    'arraybuffer',
  )
  const contentTypeKey = Object.keys(response.header).find((key) => key.toLowerCase() === 'content-type')
  const contentType = contentTypeKey ? response.header[contentTypeKey] : ''
  if (response.statusCode < 200
    || response.statusCode >= 300
    || !(response.data instanceof ArrayBuffer)
    || response.data.byteLength === 0
    || !contentType.toLowerCase().startsWith('image/')) {
    throw new Error('封面加载失败')
  }
  await writeFile(filePath, response.data)
  touchImageCache(filePath)
  return filePath
}

export function getFavorites(): FavoriteItem[] {
  migrateLegacyFavorites()
  const value = wx.getStorageSync<FavoriteItem[]>(FAVORITES_STORAGE_KEY)
  return Array.isArray(value)
    ? value
      .map((item) => normalizeFavorite(item))
      .sort((left, right) => right.savedAt - left.savedAt)
    : []
}

function normalizeFavorite(item: FavoriteItem): FavoriteItem {
  const supportsProgress = item.category !== 'movie'
  const userRating = Number.isFinite(item.userRating)
    ? Math.min(5, Math.max(0, item.userRating))
    : 0
  const rawCurrentProgress = supportsProgress && Number.isFinite(item.currentProgress)
    ? Math.max(0, Math.floor(item.currentProgress))
    : 0
  const totalProgress = supportsProgress && Number.isFinite(item.totalProgress)
    ? Math.max(0, Math.floor(item.totalProgress))
    : 0
  const currentProgress = totalProgress > 0
    ? Math.min(rawCurrentProgress, totalProgress)
    : rawCurrentProgress
  const progressPercentage = totalProgress > 0
    ? Math.min(100, Math.round(currentProgress / totalProgress * 100))
    : 0
  const status: FavoriteStatus = item.status === 'active' || item.status === 'completed'
    ? item.status
    : 'planned'
  return {
    ...item,
    userRating,
    currentProgress,
    totalProgress,
    progressPercentage,
    status,
  }
}

function migrateLegacyFavorites(): void {
  if (wx.getStorageSync<boolean>(LEGACY_FAVORITES_MIGRATION_KEY)) {
    return
  }
  const storedFavorites = wx.getStorageSync<FavoriteItem[]>(FAVORITES_STORAGE_KEY)
  const favorites = Array.isArray(storedFavorites) ? storedFavorites : []
  const legacyMigrationV1Done = wx.getStorageSync<boolean>(LEGACY_FAVORITES_MIGRATION_V1_KEY)
  const legacyValue = legacyMigrationV1Done
    ? []
    : wx.getStorageSync<Array<Record<string, unknown>>>(LEGACY_ENTRIES_STORAGE_KEY)
  const legacyEntries = Array.isArray(legacyValue) ? legacyValue : []
  const legacyDeletedValue = wx.getStorageSync<string[]>(LEGACY_DELETED_STORAGE_KEY)
  const legacyDeletedIds = Array.isArray(legacyDeletedValue) ? legacyDeletedValue : []
  const deletedFavoriteValue = wx.getStorageSync<string[]>(DELETED_FAVORITES_STORAGE_KEY)
  const deletedFavoriteIds = Array.isArray(deletedFavoriteValue) ? deletedFavoriteValue : []
  const existingIds = new Set(favorites.map((item) => item.favoriteId))
  const migratedEntries = legacyEntries
    .filter((entry) => entry.type === 'media'
      && !String(entry.id || '').startsWith('sample-')
      && !legacyDeletedIds.includes(String(entry.id || '')))
    .map((entry): FavoriteItem | null => {
      const legacyCategory = String(entry.mediaCategory || '')
      const category: FavoriteCategory = legacyCategory === 'kdrama'
        ? 'series'
        : legacyCategory === 'book' || legacyCategory === 'anime' || legacyCategory === 'movie'
          ? legacyCategory
          : 'movie'
      const id = String(entry.id || '')
      const title = String(entry.content || '').trim()
      if (!id || !title) {
        return null
      }
      const favoriteId = `legacy-${category}-${id}`
      if (existingIds.has(favoriteId) || deletedFavoriteIds.includes(favoriteId)) {
        return null
      }
      const recordedAt = String(entry.recordedAt || '')
      const parsedTime = Date.parse(recordedAt.replace(' ', 'T'))
      const totalProgress = toStoredInteger(entry.totalProgress)
      const currentProgress = totalProgress > 0
        ? Math.min(toStoredInteger(entry.currentProgress), totalProgress)
        : toStoredInteger(entry.currentProgress)
      const statusValue = String(entry.status || '')
      const status: FavoriteStatus = statusValue === 'completed'
        ? 'completed'
        : statusValue === 'active' ? 'active' : 'planned'
      return {
        id,
        category,
        title,
        subtitle: '',
        cover: '',
        year: '',
        author: '',
        episode: '',
        rating: '',
        description: String(entry.detail || ''),
        sourceType: legacyCategory,
        sourceUrl: '',
        favoriteId,
        savedAt: Number.isFinite(parsedTime) ? parsedTime : Date.now(),
        userRating: 0,
        currentProgress,
        totalProgress,
        progressPercentage: getStoredPercentage(currentProgress, totalProgress),
        status,
      }
    })
    .filter((item): item is FavoriteItem => item !== null)
  const earliestValue = wx.getStorageSync<Record<string, unknown> | Array<Record<string, unknown>>>(
    EARLIEST_MEDIA_STORAGE_KEY,
  )
  const earliestEntries = Array.isArray(earliestValue)
    ? earliestValue
    : earliestValue && typeof earliestValue === 'object' ? [earliestValue] : []
  const knownItems = new Set(
    [...favorites, ...migratedEntries].map((item) => `${item.category}:${item.title.trim().toLowerCase()}`),
  )
  const migratedEarliest = earliestEntries
    .map((entry): FavoriteItem | null => {
      const legacyCategory = String(entry.category || '')
      const category: FavoriteCategory = legacyCategory === 'kdrama'
        ? 'series'
        : legacyCategory === 'book' || legacyCategory === 'anime' || legacyCategory === 'movie'
          ? legacyCategory
          : 'movie'
      const id = String(entry.id || '')
      const title = String(entry.title || '').trim()
      const favoriteId = `earliest-${category}-${id}`
      if (!id
        || !title
        || knownItems.has(`${category}:${title.toLowerCase()}`)
        || legacyDeletedIds.includes(id)
        || legacyDeletedIds.includes(`legacy-${id}`)
        || deletedFavoriteIds.includes(favoriteId)) {
        return null
      }
      const recordedAt = String(entry.recordedAt || '')
      const parsedTime = Date.parse(recordedAt.replace(' ', 'T'))
      const totalProgress = toStoredInteger(entry.totalProgress)
      const currentProgress = totalProgress > 0
        ? Math.min(toStoredInteger(entry.currentProgress), totalProgress)
        : toStoredInteger(entry.currentProgress)
      const statusValue = String(entry.status || '')
      const status: FavoriteStatus = statusValue === 'completed'
        ? 'completed'
        : statusValue === 'in-progress' || statusValue === 'active' ? 'active' : 'planned'
      return {
        id,
        category,
        title,
        subtitle: '',
        cover: '',
        year: '',
        author: '',
        episode: '',
        rating: '',
        description: String(entry.note || ''),
        sourceType: legacyCategory,
        sourceUrl: '',
        favoriteId,
        savedAt: Number.isFinite(parsedTime) ? parsedTime : Date.now(),
        userRating: 0,
        currentProgress,
        totalProgress,
        progressPercentage: getStoredPercentage(currentProgress, totalProgress),
        status,
      }
    })
    .filter((item): item is FavoriteItem => item !== null)
  const migrated = [...migratedEntries, ...migratedEarliest]
  if (migrated.length) {
    wx.setStorageSync(FAVORITES_STORAGE_KEY, [...favorites, ...migrated])
  }
  wx.setStorageSync(LEGACY_FAVORITES_MIGRATION_KEY, true)
}

function toStoredInteger(value: unknown): number {
  return Math.max(0, Math.floor(Number(value) || 0))
}

function getStoredPercentage(current: number, total: number): number {
  return total > 0 ? Math.min(100, Math.round(current / total * 100)) : 0
}

export function isFavorite(category: FavoriteCategory, id: string): boolean {
  return getFavorites().some((item) => item.category === category && item.id === id)
}

export function saveFavorite(item: CatalogItem): boolean {
  const favorites = getFavorites()
  if (favorites.some((favorite) => favorite.category === item.category && favorite.id === item.id)) {
    return false
  }
  const favorite: FavoriteItem = {
    id: item.id,
    category: item.category,
    title: item.title,
    subtitle: item.subtitle || '',
    cover: item.cover || '',
    year: item.year || '',
    author: item.author || '',
    episode: item.episode || '',
    rating: item.rating || '',
    description: item.description || '',
    sourceType: item.sourceType || '',
    sourceUrl: item.sourceUrl || '',
    favoriteId: `${item.category}-${item.id}`,
    savedAt: Date.now(),
    userRating: 0,
    currentProgress: 0,
    totalProgress: 0,
    progressPercentage: 0,
    status: 'planned',
  }
  wx.setStorageSync(FAVORITES_STORAGE_KEY, [favorite, ...favorites])
  return true
}

export function deleteFavorite(favoriteId: string): void {
  wx.setStorageSync(
    FAVORITES_STORAGE_KEY,
    getFavorites().filter((item) => item.favoriteId !== favoriteId),
  )
  const deletedValue = wx.getStorageSync<string[]>(DELETED_FAVORITES_STORAGE_KEY)
  const deletedIds = Array.isArray(deletedValue) ? deletedValue : []
  wx.setStorageSync(DELETED_FAVORITES_STORAGE_KEY, Array.from(new Set([...deletedIds, favoriteId])))
}

export function updateFavoriteDetails(
  favoriteId: string,
  userRating: number,
  currentProgress: number,
  totalProgress: number,
  status: FavoriteStatus,
): FavoriteItem | undefined {
  const favorites = getFavorites()
  const target = favorites.find((item) => item.favoriteId === favoriteId)
  if (!target) {
    return undefined
  }
  const updated = normalizeFavorite({
    ...target,
    userRating,
    currentProgress,
    totalProgress,
    status,
  })
  wx.setStorageSync(
    FAVORITES_STORAGE_KEY,
    favorites.map((item) => item.favoriteId === favoriteId ? updated : item),
  )
  return updated
}

export function updateFavoriteMetadata(
  favoriteId: string,
  detail: CatalogDetail,
): FavoriteItem | undefined {
  const favorites = getFavorites()
  const target = favorites.find((item) => item.favoriteId === favoriteId)
  if (!target) {
    return undefined
  }
  const updated: FavoriteItem = {
    ...target,
    description: detail.description || target.description,
    rating: detail.rating || target.rating,
    sourceUrl: detail.sourceUrl || target.sourceUrl,
  }
  wx.setStorageSync(
    FAVORITES_STORAGE_KEY,
    favorites.map((item) => item.favoriteId === favoriteId ? updated : item),
  )
  return updated
}

export function vibrateLight(): void {
  wx.vibrateShort({ type: 'light', fail: () => {} })
}
