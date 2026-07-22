/// <reference path="./types/index.d.ts" />

interface IAppOption {
  globalData: {
    userInfo?: WechatMiniprogram.UserInfo,
  }
  userInfoReadyCallback?: WechatMiniprogram.GetUserInfoSuccessCallback,
}

type CloudContainerMethod =
  | 'OPTIONS'
  | 'GET'
  | 'HEAD'
  | 'POST'
  | 'PUT'
  | 'DELETE'
  | 'TRACE'
  | 'CONNECT'

interface CloudContainerRequest {
  config: {
    env: string
  }
  path: string
  header: Record<string, string>
  method?: CloudContainerMethod
  data?: string | object | ArrayBuffer
  timeout?: number
  dataType?: string
  responseType?: 'text' | 'arraybuffer'
}

interface CloudContainerResult<T> {
  data: T
  statusCode: number
  header: Record<string, string>
  cookies: string[]
  errMsg: string
  callID?: string
}

interface WxCloud {
  callContainer<T = unknown>(
    request: CloudContainerRequest,
  ): Promise<CloudContainerResult<T>>
}
