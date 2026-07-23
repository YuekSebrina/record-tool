import {
  CatalogItem,
  categoryOptions,
  FavoriteCategory,
  FavoriteItem,
  getCatalogDetail,
  getDisplayCover,
  getFavorites,
  getTrendingCatalog,
  isFavorite,
  saveFavorite,
  searchCatalog,
  vibrateLight,
} from '../../utils/catalog'

type SearchFilter = FavoriteCategory | 'all'

interface SearchResultView extends CatalogItem {
  resultKey: string
  displayCover: string
  favorited: boolean
  categoryLabel: string
  categoryMark: string
}

interface RecentFavoriteView extends FavoriteItem {
  displayCover: string
  categoryLabel: string
  categoryMark: string
}

let currentSearchId = 0
let currentDetailId = 0
let currentRecentId = 0
let currentTrendingId = 0
let keyboardHeightHandler: WechatMiniprogram.OnKeyboardHeightChangeCallback | null = null

function getCategoryMark(category: FavoriteCategory): string {
  const option = categoryOptions.find((item) => item.key === category)
  return option ? option.mark : '藏'
}

function getCategoryLabel(category: FavoriteCategory): string {
  const option = categoryOptions.find((item) => item.key === category)
  return option ? option.label : ''
}

function toSearchResultView(item: CatalogItem): SearchResultView {
  return {
    ...item,
    resultKey: `${item.category}-${item.id}`,
    displayCover: '',
    favorited: isFavorite(item.category, item.id),
    categoryLabel: getCategoryLabel(item.category),
    categoryMark: getCategoryMark(item.category),
  }
}

function normalizeLegacySearchItem(item: CatalogItem): CatalogItem {
  if (item.category === 'movie' && item.episode.trim()) {
    return { ...item, category: 'series' }
  }
  return item
}

Page({
  data: {
    keyword: '',
    hasKeyword: false,
    pageTopStyle: '',
    searchDockStyle: '',
    searchFilter: 'all' as SearchFilter,
    filterLabel: '全部',
    searchPlaceholder: '搜索书籍 / 动漫 / 电影 / 剧集',
    filterVisible: false,
    filterOptions: [
      { label: '全部', value: 'all', mark: '全' },
      ...categoryOptions.map((item) => ({ label: item.label, value: item.key, mark: item.mark })),
    ],
    recentFavorites: [] as RecentFavoriteView[],
    trendingItems: [] as SearchResultView[],
    trendingLoading: true,
    trendingError: '',
    trendingSkeletons: [1, 2, 3, 4],
    results: [] as SearchResultView[],
    loading: false,
    searched: false,
    errorMessage: '',
    detailVisible: false,
    detailLoading: false,
    detailError: '',
    detailGenres: '',
    detailCreators: '',
    selectedResult: null as SearchResultView | null,
    skeletonItems: [1, 2, 3],
    skeletonRows: [[
      { width: '140rpx', height: '190rpx', type: 'rect', marginRight: '24rpx' },
      { width: '55%', height: '32rpx', type: 'text' },
    ], [
      { width: '140rpx', height: '1rpx', type: 'rect', marginRight: '24rpx' },
      { width: '35%', height: '24rpx', type: 'text' },
    ]],
  },

  onLoad() {
    const menuButton = wx.getMenuButtonBoundingClientRect()
    this.setData({ pageTopStyle: `padding-top: ${Math.max(0, menuButton.top - 6)}px;` })
    keyboardHeightHandler = (result) => this.updateSearchDockForKeyboard(result.height)
    wx.onKeyboardHeightChange(keyboardHeightHandler)
  },

  onShow() {
    const selectedResult = this.data.selectedResult
      ? {
        ...this.data.selectedResult,
        favorited: isFavorite(this.data.selectedResult.category, this.data.selectedResult.id),
      }
      : null
    this.setData({
      results: this.data.results.map((item) => ({
        ...item,
        favorited: isFavorite(item.category, item.id),
      })),
      selectedResult,
    })
    this.loadRecentFavorites()
    this.loadTrending()
  },

  onUnload() {
    currentSearchId += 1
    currentDetailId += 1
    currentRecentId += 1
    currentTrendingId += 1
    if (keyboardHeightHandler) {
      wx.offKeyboardHeightChange(keyboardHeightHandler)
      keyboardHeightHandler = null
    }
  },

  handleKeywordChange(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    const keyword = event.detail.value
    this.setData({ keyword, hasKeyword: Boolean(keyword.trim()) })
  },

  handleSearchFocus() {
    vibrateLight()
  },

  handleKeyboardHeightChange(event: WechatMiniprogram.CustomEvent<{ height: number }>) {
    this.updateSearchDockForKeyboard(event.detail.height)
  },

  handleSearchBlur() {
    this.updateSearchDockForKeyboard(0)
  },

  updateSearchDockForKeyboard(height: number) {
    const keyboardHeight = Math.max(0, Number(height) || 0)
    this.setData({
      searchDockStyle: keyboardHeight > 0
        ? `bottom: calc(${keyboardHeight}px + 16rpx);`
        : '',
    })
  },

  clearKeyword() {
    vibrateLight()
    currentSearchId += 1
    this.setData({
      keyword: '',
      hasKeyword: false,
      results: [],
      loading: false,
      searched: false,
      errorMessage: '',
    })
  },

  openFilter() {
    vibrateLight()
    this.setData({ filterVisible: true })
  },

  closeFilter() {
    vibrateLight()
    this.setData({ filterVisible: false })
  },

  selectFilter(event: WechatMiniprogram.BaseEvent) {
    const value = String(event.currentTarget.dataset.value)
    const searchFilter: SearchFilter = value === 'book'
      || value === 'anime'
      || value === 'movie'
      || value === 'series'
      ? value
      : 'all'
    const option = this.data.filterOptions.find((item) => item.value === searchFilter)
    vibrateLight()
    this.setData({
      searchFilter,
      filterLabel: option ? option.label : '全部',
      searchPlaceholder: searchFilter === 'all'
        ? '搜索书籍 / 动漫 / 电影 / 剧集'
        : `搜索${option ? option.label : '作品'}`,
      filterVisible: false,
    }, () => {
      if (this.data.searched && this.data.hasKeyword) {
        void this.runSearch()
      }
    })
  },

  preventFilterClose() {},

  goToFavorites() {
    vibrateLight()
    wx.redirectTo({ url: '/pages/records/records' })
  },

  loadRecentFavorites() {
    const recentId = ++currentRecentId
    const recentFavorites: RecentFavoriteView[] = getFavorites().slice(0, 4).map((item) => ({
      ...item,
      displayCover: '',
      categoryLabel: getCategoryLabel(item.category),
      categoryMark: getCategoryMark(item.category),
    }))
    this.setData({ recentFavorites })
    Promise.all(recentFavorites.map(async (item) => {
      try {
        return { favoriteId: item.favoriteId, displayCover: await getDisplayCover(item.cover) }
      } catch (_error) {
        return { favoriteId: item.favoriteId, displayCover: '' }
      }
    })).then((covers) => {
      if (recentId !== currentRecentId) {
        return
      }
      const coverMap = new Map(covers.map((item) => [item.favoriteId, item.displayCover]))
      this.setData({
        recentFavorites: this.data.recentFavorites.map((item) => ({
          ...item,
          displayCover: coverMap.get(item.favoriteId) || item.displayCover,
        })),
      })
    })
  },

  async loadTrending() {
    const trendingId = ++currentTrendingId
    this.setData({ trendingLoading: true, trendingError: '' })
    try {
      const items = await getTrendingCatalog()
      if (trendingId !== currentTrendingId) {
        return
      }
      const trendingItems = items.map(toSearchResultView)
      this.setData({ trendingItems, trendingLoading: false })
      const hydrated = await Promise.all(trendingItems.map(async (item) => {
        try {
          return { resultKey: item.resultKey, displayCover: await getDisplayCover(item.cover) }
        } catch (_error) {
          return { resultKey: item.resultKey, displayCover: '' }
        }
      }))
      if (trendingId !== currentTrendingId) {
        return
      }
      const coverMap = new Map(hydrated.map((item) => [item.resultKey, item.displayCover]))
      this.setData({
        trendingItems: this.data.trendingItems.map((item) => ({
          ...item,
          displayCover: coverMap.get(item.resultKey) || item.displayCover,
        })),
      })
    } catch (_error) {
      if (trendingId === currentTrendingId) {
        this.setData({
          trendingItems: [],
          trendingLoading: false,
          trendingError: '热门内容暂时无法加载，点击重试',
        })
      }
    }
  },

  retryTrending() {
    vibrateLight()
    void this.loadTrending()
  },

  async runSearch() {
    const keyword = this.data.keyword.trim()
    if (!keyword) {
      wx.showToast({ title: '请输入名称', icon: 'none' })
      return
    }
    vibrateLight()
    const searchId = ++currentSearchId
    this.setData({ loading: true, searched: true, errorMessage: '', results: [] })
    try {
      const categories: Array<FavoriteCategory | 'media'> = this.data.searchFilter === 'all'
        ? ['book', 'media']
        : [this.data.searchFilter]
      const responses = await Promise.all(categories.map(async (category) => {
        try {
          return { success: true, items: await searchCatalog(keyword, category), error: null }
        } catch (error) {
          if (category === 'media'
            && error instanceof Error
            && error.message.includes('HTTP 400')) {
            try {
              const items = await searchCatalog(keyword, 'movie')
              return { success: true, items: items.map(normalizeLegacySearchItem), error: null }
            } catch (_fallbackError) {
              // Keep the original media error so the partial-search message remains useful.
            }
          }
          return { success: false, items: [] as CatalogItem[], error }
        }
      }))
      if (searchId !== currentSearchId) {
        return
      }
      if (!responses.some((response) => response.success)) {
        const error = responses[0] && responses[0].error
        throw error instanceof Error ? error : new Error('搜索失败，请稍后重试')
      }
      const uniqueItems = new Map<string, CatalogItem>()
      responses
        .flatMap((response) => response.items)
        .map(normalizeLegacySearchItem)
        .filter((item) => this.data.searchFilter === 'all' || item.category === this.data.searchFilter)
        .forEach((item) => {
          const key = item.category === 'book' ? `book-${item.id}` : `media-${item.id}`
          if (!uniqueItems.has(key)) {
            uniqueItems.set(key, item)
          }
        })
      const results = Array.from(uniqueItems.values()).map(toSearchResultView)
      this.setData({ results, loading: false })
      if (responses.some((response) => !response.success)) {
        wx.showToast({ title: '部分分类暂时不可用', icon: 'none' })
      }
      const hydrated = await Promise.all(results.map(async (item) => {
        try {
          return { ...item, displayCover: await getDisplayCover(item.cover) }
        } catch (_error) {
          return item
        }
      }))
      if (searchId === currentSearchId) {
        const covers = new Map(hydrated.map((item) => [item.resultKey, item.displayCover]))
        this.setData({
          results: this.data.results.map((item) => ({
            ...item,
            displayCover: covers.get(item.resultKey) || item.displayCover,
          })),
        })
      }
    } catch (error) {
      if (searchId === currentSearchId) {
        this.setData({
          loading: false,
          errorMessage: error instanceof Error ? error.message : '搜索失败，请稍后重试',
        })
      }
    }
  },

  addFavorite(event: WechatMiniprogram.BaseEvent) {
    const { key } = event.currentTarget.dataset as { key: string }
    const item = this.data.results.find((result) => result.resultKey === key)
    if (!item || item.favorited) {
      return
    }
    saveFavorite(item)
    vibrateLight()
    this.setData({
      results: this.data.results.map((result) => result.resultKey === key
        ? { ...result, favorited: true }
        : result),
      selectedResult: this.data.selectedResult && this.data.selectedResult.resultKey === key
        ? { ...this.data.selectedResult, favorited: true }
        : this.data.selectedResult,
      trendingItems: this.data.trendingItems.map((result) => result.resultKey === key
        ? { ...result, favorited: true }
        : result),
    })
    this.loadRecentFavorites()
    wx.showToast({ title: '已收藏', icon: 'success' })
  },

  async openResult(event: WechatMiniprogram.BaseEvent) {
    const { key } = event.currentTarget.dataset as { key: string }
    const result = this.data.results.find((item) => item.resultKey === key)
    if (!result) {
      return
    }
    await this.showResultDetail(result)
  },

  async openTrending(event: WechatMiniprogram.BaseEvent) {
    const { key } = event.currentTarget.dataset as { key: string }
    const result = this.data.trendingItems.find((item) => item.resultKey === key)
    if (!result) {
      return
    }
    await this.showResultDetail(result)
  },

  async showResultDetail(result: SearchResultView) {
    const detailId = ++currentDetailId
    vibrateLight()
    this.setData({
      detailVisible: true,
      detailLoading: true,
      detailError: '',
      detailGenres: '',
      detailCreators: '',
      selectedResult: result,
    })
    try {
      const detail = await getCatalogDetail(result.id, result.category)
      if (detailId !== currentDetailId) {
        return
      }
      const updatedResult: SearchResultView = {
        ...result,
        description: detail.description || result.description,
        rating: detail.rating || result.rating,
        sourceUrl: detail.sourceUrl || result.sourceUrl,
      }
      this.setData({
        detailLoading: false,
        detailError: detail.description ? '' : '豆瓣暂未提供简介',
        detailGenres: detail.genres.join(' / '),
        detailCreators: detail.creators.join(' / '),
        selectedResult: updatedResult,
        results: this.data.results.map((item) => item.resultKey === result.resultKey ? updatedResult : item),
        trendingItems: this.data.trendingItems.map((item) => item.resultKey === result.resultKey
          ? updatedResult
          : item),
      })
    } catch (error) {
      if (detailId === currentDetailId) {
        this.setData({
          detailLoading: false,
          detailError: error instanceof Error ? error.message : '暂时无法获取简介',
        })
      }
    }
  },

  closeDetail() {
    vibrateLight()
    currentDetailId += 1
    this.setData({ detailVisible: false, selectedResult: null })
  },

  preventDetailClose() {},

  addSelectedFavorite() {
    const item = this.data.selectedResult
    if (!item || item.favorited) {
      return
    }
    saveFavorite(item)
    vibrateLight()
    this.setData({
      selectedResult: { ...item, favorited: true },
      results: this.data.results.map((result) => result.resultKey === item.resultKey
        ? { ...result, favorited: true }
        : result),
      trendingItems: this.data.trendingItems.map((result) => result.resultKey === item.resultKey
        ? { ...result, favorited: true }
        : result),
    })
    this.loadRecentFavorites()
    wx.showToast({ title: '已收藏', icon: 'success' })
  },
})
