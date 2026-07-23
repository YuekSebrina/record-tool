import {
  CatalogItem,
  categoryOptions,
  FavoriteCategory,
  getCatalogDetail,
  getDisplayCover,
  isFavorite,
  saveFavorite,
  searchCatalog,
  vibrateLight,
} from '../../utils/catalog'

type SearchType = 'media' | 'book'

interface SearchResultView extends CatalogItem {
  displayCover: string
  favorited: boolean
}

interface ValueEventDetail {
  value: string | number
}

let currentSearchId = 0
let currentDetailId = 0

function getCategoryMark(category: FavoriteCategory): string {
  const option = categoryOptions.find((item) => item.key === category)
  return option ? option.mark : '藏'
}

Page({
  data: {
    keyword: '',
    searchType: 'media' as SearchType,
    selectedMediaCategory: 'movie' as FavoriteCategory,
    selectedCategory: 'movie' as FavoriteCategory,
    selectedCategoryMark: '影',
    mediaCategories: [
      { label: '电影', value: 'movie' },
      { label: '动漫', value: 'anime' },
      { label: '剧集', value: 'series' },
    ],
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
  },

  onUnload() {
    currentSearchId += 1
    currentDetailId += 1
  },

  handleKeywordChange(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ keyword: event.detail.value })
  },

  selectSearchType(event: WechatMiniprogram.CustomEvent<ValueEventDetail>) {
    const searchType: SearchType = String(event.detail.value) === 'book' ? 'book' : 'media'
    const selectedCategory: FavoriteCategory = searchType === 'book'
      ? 'book'
      : this.data.selectedMediaCategory
    this.resetSearch(searchType, selectedCategory)
  },

  selectMediaCategory(event: WechatMiniprogram.CustomEvent<ValueEventDetail>) {
    const value = String(event.detail.value)
    const selectedCategory: FavoriteCategory = value === 'anime' || value === 'series'
      ? value
      : 'movie'
    this.setData({ selectedMediaCategory: selectedCategory })
    this.resetSearch('media', selectedCategory)
  },

  resetSearch(searchType: SearchType, selectedCategory: FavoriteCategory) {
    currentSearchId += 1
    this.setData({
      searchType,
      selectedCategory,
      selectedCategoryMark: getCategoryMark(selectedCategory),
      results: [],
      loading: false,
      searched: false,
      errorMessage: '',
    })
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
      const items = await searchCatalog(keyword, this.data.selectedCategory)
      if (searchId !== currentSearchId) {
        return
      }
      const results: SearchResultView[] = items.map((item) => ({
        ...item,
        displayCover: '',
        favorited: isFavorite(item.category, item.id),
      }))
      this.setData({ results, loading: false })
      const hydrated = await Promise.all(results.map(async (item) => {
        try {
          return { ...item, displayCover: await getDisplayCover(item.cover) }
        } catch (_error) {
          return item
        }
      }))
      if (searchId === currentSearchId) {
        const covers = new Map(hydrated.map((item) => [item.id, item.displayCover]))
        this.setData({
          results: this.data.results.map((item) => ({
            ...item,
            displayCover: covers.get(item.id) || item.displayCover,
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
    const { id } = event.currentTarget.dataset as { id: string }
    const item = this.data.results.find((result) => result.id === id)
    if (!item || item.favorited) {
      return
    }
    saveFavorite(item)
    vibrateLight()
    this.setData({
      results: this.data.results.map((result) => result.id === id
        ? { ...result, favorited: true }
        : result),
      selectedResult: this.data.selectedResult && this.data.selectedResult.id === id
        ? { ...this.data.selectedResult, favorited: true }
        : this.data.selectedResult,
    })
    wx.showToast({ title: '已收藏', icon: 'success' })
  },

  async openResult(event: WechatMiniprogram.BaseEvent) {
    const { id } = event.currentTarget.dataset as { id: string }
    const result = this.data.results.find((item) => item.id === id)
    if (!result) {
      return
    }
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
        results: this.data.results.map((item) => item.id === id ? updatedResult : item),
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
      results: this.data.results.map((result) => result.id === item.id
        ? { ...result, favorited: true }
        : result),
    })
    wx.showToast({ title: '已收藏', icon: 'success' })
  },
})
