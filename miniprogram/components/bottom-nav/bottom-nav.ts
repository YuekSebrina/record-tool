Component({
  properties: {
    active: {
      type: String,
      value: 'search',
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

      wx.vibrateShort({ type: 'light', fail: () => {} })
      wx.redirectTo({ url })
    },
  },
})
