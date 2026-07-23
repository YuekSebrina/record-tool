import {
  CatalogDetail,
  categoryOptions,
  deleteFavorite,
  FavoriteCategory,
  FavoriteItem,
  FavoriteStatus,
  getCatalogDetail,
  getDisplayCover,
  getFavorites,
  pinDisplayCovers,
  updateFavoriteDetails,
  updateFavoriteMetadata,
  vibrateLight,
} from '../../utils/catalog'

type CollectionLayout = 'list' | 'grid'

interface FavoriteView extends FavoriteItem {
  displayCover: string
  statusLabel: string
}

interface CategoryView {
  key: FavoriteCategory
  label: string
  mark: string
  count: number
  tabLabel: string
}

interface ValueEventDetail {
  value: string | number
}

let currentLoadId = 0
let currentFavoriteDetailId = 0

function toNonNegativeInteger(value: string | number): number {
  return Math.max(0, Math.floor(Number(value) || 0))
}

function getProgressPercentage(current: number, total: number): number {
  return total > 0 ? Math.min(100, Math.round(current / total * 100)) : 0
}

function getStatusOptions(category: FavoriteCategory) {
  return category === 'book'
    ? [
      { label: '未读', value: 'planned' },
      { label: '在读', value: 'active' },
      { label: '已读', value: 'completed' },
    ]
    : [
      { label: '未看', value: 'planned' },
      { label: '在看', value: 'active' },
      { label: '已看', value: 'completed' },
    ]
}

function getStatusLabel(category: FavoriteCategory, status: FavoriteStatus): string {
  const option = getStatusOptions(category).find((item) => item.value === status)
  return option ? option.label : ''
}

Page({
  data: {
    categories: [] as CategoryView[],
    selectedCategory: 'movie' as FavoriteCategory,
    selectedCategoryMark: '影',
    selectedCategoryLabel: '电影',
    layout: 'list' as CollectionLayout,
    layoutOptions: [
      { label: '列表', value: 'list' },
      { label: '宫格', value: 'grid' },
    ],
    favorites: [] as FavoriteView[],
    totalCount: 0,
    editorVisible: false,
    editingFavorite: null as FavoriteView | null,
    editingRating: 0,
    editingCurrentProgress: 0,
    editingTotalProgress: 0,
    editingPercentage: 0,
    editingStatus: 'planned' as FavoriteStatus,
    statusOptions: getStatusOptions('movie'),
    progressCurrentLabel: '已看集数',
    progressTotalLabel: '总集数',
    progressUnit: '集',
    supportsProgress: false,
    detailVisible: false,
    detailLoading: false,
    detailError: '',
    detailGenres: '',
    detailCreators: '',
    detailFavorite: null as FavoriteView | null,
  },

  onShow() {
    this.loadFavorites()
  },

  onUnload() {
    currentLoadId += 1
    currentFavoriteDetailId += 1
    pinDisplayCovers([])
  },

  selectCategory(event: WechatMiniprogram.CustomEvent<ValueEventDetail>) {
    const value = String(event.detail.value)
    const selectedCategory: FavoriteCategory = value === 'book'
      || value === 'anime'
      || value === 'series'
      ? value
      : 'movie'
    const option = categoryOptions.find((item) => item.key === selectedCategory) || categoryOptions[0]
    const isBook = selectedCategory === 'book'
    this.setData({
      selectedCategory,
      selectedCategoryMark: option.mark,
      selectedCategoryLabel: option.label,
      editorVisible: false,
      editingFavorite: null,
      detailVisible: false,
      detailFavorite: null,
      progressCurrentLabel: isBook ? '已读页数' : '已看集数',
      progressTotalLabel: isBook ? '总页数' : '总集数',
      progressUnit: isBook ? '页' : '集',
      supportsProgress: selectedCategory !== 'movie',
      statusOptions: getStatusOptions(selectedCategory),
    }, () => this.loadFavorites())
  },

  switchLayout(event: WechatMiniprogram.CustomEvent<ValueEventDetail>) {
    const layout: CollectionLayout = String(event.detail.value) === 'grid' ? 'grid' : 'list'
    vibrateLight()
    this.setData({ layout })
  },

  loadFavorites() {
    const loadId = ++currentLoadId
    const allFavorites = getFavorites()
    const categories = categoryOptions.map((category) => {
      const count = allFavorites.filter((item) => item.category === category.key).length
      return {
        key: category.key,
        label: category.label,
        mark: category.mark,
        count,
        tabLabel: `${category.label} ${count}`,
      }
    })
    const favorites: FavoriteView[] = allFavorites
      .filter((item) => item.category === this.data.selectedCategory)
      .map((item) => ({
        ...item,
        displayCover: '',
        statusLabel: getStatusLabel(item.category, item.status),
      }))
    pinDisplayCovers(favorites.map((item) => item.cover))
    this.setData({ categories, favorites, totalCount: allFavorites.length })

    Promise.all(favorites.map(async (item) => {
      try {
        return { ...item, displayCover: await getDisplayCover(item.cover) }
      } catch (_error) {
        return item
      }
    })).then((hydrated) => {
      if (loadId === currentLoadId) {
        const covers = new Map(hydrated.map((item) => [item.favoriteId, item.displayCover]))
        this.setData({
          favorites: this.data.favorites.map((item) => ({
            ...item,
            displayCover: covers.get(item.favoriteId) || item.displayCover,
          })),
        })
      }
    })
  },

  changeRating(event: WechatMiniprogram.CustomEvent<ValueEventDetail>) {
    const { id } = event.currentTarget.dataset as { id: string }
    const favorite = this.data.favorites.find((item) => item.favoriteId === id)
    if (!favorite) {
      return
    }
    const userRating = Math.min(5, Math.max(0, Number(event.detail.value) || 0))
    updateFavoriteDetails(id, userRating, favorite.currentProgress, favorite.totalProgress, favorite.status)
    vibrateLight()
    this.setData({
      favorites: this.data.favorites.map((item) => item.favoriteId === id
        ? { ...item, userRating }
        : item),
    })
  },

  openEditor(event: WechatMiniprogram.BaseEvent) {
    const { id } = event.currentTarget.dataset as { id: string }
    const editingFavorite = this.data.favorites.find((item) => item.favoriteId === id)
    if (!editingFavorite) {
      return
    }
    vibrateLight()
    this.setData({
      editorVisible: true,
      editingFavorite,
      editingRating: editingFavorite.userRating,
      editingCurrentProgress: editingFavorite.currentProgress,
      editingTotalProgress: editingFavorite.totalProgress,
      editingPercentage: editingFavorite.progressPercentage,
      editingStatus: editingFavorite.status,
    })
  },

  closeEditor() {
    this.setData({ editorVisible: false, editingFavorite: null })
  },

  preventClose() {},

  changeEditorRating(event: WechatMiniprogram.CustomEvent<ValueEventDetail>) {
    vibrateLight()
    this.setData({ editingRating: Number(event.detail.value) || 0 })
  },

  changeEditorStatus(event: WechatMiniprogram.BaseEvent) {
    const value = String(event.currentTarget.dataset.value)
    const editingStatus: FavoriteStatus = value === 'active' || value === 'completed'
      ? value
      : 'planned'
    vibrateLight()
    this.setData({ editingStatus })
  },

  changeCurrentProgress(event: WechatMiniprogram.CustomEvent<ValueEventDetail>) {
    const editingCurrentProgress = toNonNegativeInteger(event.detail.value)
    this.setData({
      editingCurrentProgress,
      editingPercentage: getProgressPercentage(editingCurrentProgress, this.data.editingTotalProgress),
    })
  },

  adjustCurrentProgress(event: WechatMiniprogram.BaseEvent) {
    const delta = Number(event.currentTarget.dataset.delta) || 0
    const { editingCurrentProgress, editingTotalProgress } = this.data
    const upperBound = editingTotalProgress > 0 ? editingTotalProgress : 9999
    const nextProgress = Math.min(upperBound, Math.max(0, editingCurrentProgress + delta))
    if (nextProgress === editingCurrentProgress) {
      return
    }
    vibrateLight()
    this.setData({
      editingCurrentProgress: nextProgress,
      editingPercentage: getProgressPercentage(nextProgress, editingTotalProgress),
    })
  },

  changeTotalProgress(event: WechatMiniprogram.CustomEvent<ValueEventDetail>) {
    const editingTotalProgress = toNonNegativeInteger(event.detail.value)
    this.setData({
      editingTotalProgress,
      editingPercentage: getProgressPercentage(this.data.editingCurrentProgress, editingTotalProgress),
    })
  },

  saveEditor() {
    const editingFavorite = this.data.editingFavorite
    if (!editingFavorite) {
      return
    }
    if (this.data.editingTotalProgress > 0
      && this.data.editingCurrentProgress > this.data.editingTotalProgress) {
      wx.showToast({ title: `${this.data.progressCurrentLabel}不能超过${this.data.progressTotalLabel}`, icon: 'none' })
      return
    }
    updateFavoriteDetails(
      editingFavorite.favoriteId,
      this.data.editingRating,
      this.data.editingCurrentProgress,
      this.data.editingTotalProgress,
      this.data.editingStatus,
    )
    vibrateLight()
    this.setData({ editorVisible: false, editingFavorite: null })
    this.loadFavorites()
    wx.showToast({ title: '已保存', icon: 'success' })
  },

  removeFavorite(event: WechatMiniprogram.BaseEvent) {
    const { id, title } = event.currentTarget.dataset as { id: string; title: string }
    wx.showModal({
      title: '移出收藏',
      content: `确定要移除“${title}”吗？`,
      confirmText: '移除',
      confirmColor: '#d54941',
      success: (result) => {
        if (!result.confirm) {
          return
        }
        deleteFavorite(id)
        vibrateLight()
        this.setData({ editorVisible: false, editingFavorite: null })
        this.loadFavorites()
        wx.showToast({ title: '已移除', icon: 'success' })
      },
    })
  },

  copySource() {
    const favorite = this.data.detailFavorite || this.data.editingFavorite
    if (favorite && favorite.sourceUrl) {
      wx.setClipboardData({ data: favorite.sourceUrl })
    }
  },

  handleCoverError(event: WechatMiniprogram.BaseEvent) {
    const { id } = event.currentTarget.dataset as { id: string }
    this.setData({
      favorites: this.data.favorites.map((item) => item.favoriteId === id
        ? { ...item, displayCover: '' }
        : item),
    })
  },

  async openFavoriteDetail(event: WechatMiniprogram.BaseEvent) {
    const { id } = event.currentTarget.dataset as { id: string }
    const favorite = this.data.favorites.find((item) => item.favoriteId === id)
    if (!favorite) {
      return
    }
    const detailId = ++currentFavoriteDetailId
    vibrateLight()
    this.setData({
      detailVisible: true,
      detailLoading: true,
      detailError: '',
      detailGenres: '',
      detailCreators: '',
      detailFavorite: favorite,
    })
    try {
      const detail: CatalogDetail = await getCatalogDetail(favorite.id, favorite.category)
      if (detailId !== currentFavoriteDetailId) {
        return
      }
      const stored = updateFavoriteMetadata(favorite.favoriteId, detail)
      const updatedFavorite: FavoriteView = {
        ...favorite,
        ...(stored || {}),
        displayCover: favorite.displayCover,
        statusLabel: favorite.statusLabel,
      }
      this.setData({
        detailLoading: false,
        detailError: detail.description ? '' : '豆瓣暂未提供简介',
        detailGenres: detail.genres.join(' / '),
        detailCreators: detail.creators.join(' / '),
        detailFavorite: updatedFavorite,
        favorites: this.data.favorites.map((item) => item.favoriteId === id ? updatedFavorite : item),
      })
    } catch (error) {
      if (detailId === currentFavoriteDetailId) {
        this.setData({
          detailLoading: false,
          detailError: error instanceof Error ? error.message : '暂时无法获取简介',
        })
      }
    }
  },

  closeFavoriteDetail() {
    currentFavoriteDetailId += 1
    this.setData({ detailVisible: false, detailFavorite: null })
  },
})
