const CLOUD_RUN_ENV = 'prod-d8gf33lii77ef34ef'
const CLOUD_RUN_SERVICE = 'flask-tddl'

interface CountResponse {
  code: number
  data: number
}

export async function incrementCloudCount(): Promise<number> {
  const response = await wx.cloud.callContainer<CountResponse>({
    config: {
      env: CLOUD_RUN_ENV,
    },
    path: '/api/count',
    header: {
      'X-WX-SERVICE': CLOUD_RUN_SERVICE,
    },
    method: 'POST',
    data: {
      action: 'inc',
    },
    timeout: 15000,
  })

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(`云托管服务返回 HTTP ${response.statusCode}`)
  }

  if (response.data.code !== 0 || typeof response.data.data !== 'number') {
    throw new Error('云托管服务返回了无效数据')
  }

  return response.data.data
}
