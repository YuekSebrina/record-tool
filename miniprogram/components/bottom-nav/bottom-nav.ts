Component({
  properties: {
    active: {
      type: String,
      value: 'home',
    },
  },

  methods: {
    switchPage(event: WechatMiniprogram.BaseEvent) {
      const { key, url } = event.currentTarget.dataset as {
        key: string
        url: string
      }

      if (key === this.data.active) {
        return
      }

      wx.redirectTo({ url })
    },
  },
})
