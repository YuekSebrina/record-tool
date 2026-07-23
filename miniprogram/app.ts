import { warmCatalogService } from './utils/catalog'

App<IAppOption>({
  globalData: {},
  onLaunch() {
    // callContainer requires one global cloud initialization before use.
    wx.cloud.init()
    void warmCatalogService()
  },
  onShow() {
    void warmCatalogService()
  },
})
