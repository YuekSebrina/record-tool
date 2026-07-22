import { incrementCloudCount } from '../../utils/cloud-run'

Component({
  data: {
    count: 0,
    hasCount: false,
    loading: false,
    statusClass: 'idle',
    statusText: '等待调用云托管服务',
    errorMessage: '',
  },

  methods: {
    async incrementCount() {
      if (this.data.loading) {
        return
      }

      this.setData({
        loading: true,
        statusClass: 'loading',
        statusText: '正在连接 flask-tddl',
        errorMessage: '',
      })

      try {
        const count = await incrementCloudCount()
        this.setData({
          count,
          hasCount: true,
          statusClass: 'success',
          statusText: '数据已写入云托管 MySQL',
        })
      } catch (error: unknown) {
        console.error('微信云托管调用失败', error)
        this.setData({
          statusClass: 'error',
          statusText: '调用失败',
          errorMessage: '请稍后重试；若持续失败，请检查云托管服务日志。',
        })
      } finally {
        this.setData({ loading: false })
      }
    },
  },
})
