import {
  categoryMetas,
  CategoryKey,
  getPrototypeRecords,
  PrototypeRecord,
  StatusKey,
} from '../../utils/prototype-data'

type CategoryFilter = CategoryKey | 'all'
type StatusFilter = StatusKey | 'all'

Page({
  data: {
    keyword: '',
    selectedCategory: 'all' as CategoryFilter,
    selectedStatus: 'all' as StatusFilter,
    categoryFilters: [
      { key: 'all', label: '全部' },
      ...categoryMetas.map((category) => ({
        key: category.key,
        label: category.label,
      })),
    ],
    statusFilters: [
      { key: 'all', label: '全部状态' },
      { key: 'planned', label: '想看 / 想读' },
      { key: 'in-progress', label: '进行中' },
      { key: 'completed', label: '已完成' },
    ],
    records: [] as PrototypeRecord[],
    totalCount: 0,
  },

  onShow() {
    this.filterRecords()
  },

  handleSearch(event: WechatMiniprogram.Input) {
    this.setData({ keyword: event.detail.value })
    this.filterRecords(event.detail.value)
  },

  selectCategory(event: WechatMiniprogram.BaseEvent) {
    const { category } = event.currentTarget.dataset as { category: CategoryFilter }
    this.setData({ selectedCategory: category })
    this.filterRecords(undefined, category)
  },

  selectStatus(event: WechatMiniprogram.BaseEvent) {
    const { status } = event.currentTarget.dataset as { status: StatusFilter }
    this.setData({ selectedStatus: status })
    this.filterRecords(undefined, undefined, status)
  },

  filterRecords(
    nextKeyword?: string,
    nextCategory?: CategoryFilter,
    nextStatus?: StatusFilter,
  ) {
    const allRecords = getPrototypeRecords()
    const keyword = (nextKeyword ?? this.data.keyword).trim().toLowerCase()
    const category = nextCategory ?? this.data.selectedCategory
    const status = nextStatus ?? this.data.selectedStatus
    const records = allRecords.filter((record) => {
      const matchesKeyword = !keyword || record.title.toLowerCase().includes(keyword)
      const matchesCategory = category === 'all' || record.category === category
      const matchesStatus = status === 'all' || record.status === status
      return matchesKeyword && matchesCategory && matchesStatus
    })

    this.setData({ records, totalCount: allRecords.length })
  },

  clearFilters() {
    this.setData({
      keyword: '',
      selectedCategory: 'all',
      selectedStatus: 'all',
    })
    this.filterRecords('', 'all', 'all')
  },

  openRecord(event: WechatMiniprogram.BaseEvent) {
    const { id } = event.currentTarget.dataset as { id: string }
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` })
  },

  openAdd() {
    wx.navigateTo({ url: '/pages/add/add' })
  },
})
