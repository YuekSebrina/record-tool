# Record Tool

微信小程序通过 `wx.cloud.callContainer` 调用微信云托管服务。

## 云托管配置

- 环境 ID：`prod-d8gf33lii77ef34ef`
- 服务名称：`flask-tddl`
- 接口：`POST /api/count`
- 请求体：`{"action":"inc"}`
- 公网地址仅用于外部调试：`https://flask-tddl-285373-6-1456783815.sh.run.tcloudbase.com`

小程序侧配置集中在 `miniprogram/utils/cloud-run.ts`。`miniprogram/app.ts` 会在启动时执行一次 `wx.cloud.init()`。项目使用基础库 `2.32.3`，满足官方要求的 `2.23.0` 及以上版本。

`callContainer` 走微信专线，不需要将上述公网地址加入小程序服务器域名。若服务只供小程序或公众号使用，建议在云托管控制台关闭公网访问。

## MySQL 配置

数据库凭据不得写入小程序代码、Git 仓库或 Docker 镜像。小程序只调用后端接口，数据库连接由 `flask-tddl` 服务负责。

在微信云托管控制台中为后端版本配置数据库连接信息。具体变量名以现有 Flask 服务读取的名称为准，通常包括：

```text
MYSQL_HOST=<控制台显示的内网地址>
MYSQL_PORT=<控制台显示的内网端口>
MYSQL_USER=root
MYSQL_PASSWORD=<root 密码>
MYSQL_DATABASE=<业务数据库名>
```

优先使用同环境的 MySQL 内网地址，不建议开启数据库公网访问。生产环境建议新建最小权限业务账号，避免 Flask 服务长期使用 `root`。

## 本地预览

1. 使用微信开发者工具打开项目根目录。
2. 确认当前 AppID 对云托管环境有访问权限；非直属环境需要先配置资源复用。
3. 编译后点击首页的“计数 +1”。
4. 在开发者工具 Network 面板或云托管服务日志中检查调用结果。

## 参考文档

- [微信云托管产品简介](https://developers.weixin.qq.com/miniprogram/dev/wxcloudservice/wxcloudrun/src/basic/intro.html)
- [微信小程序访问云托管服务](https://developers.weixin.qq.com/miniprogram/dev/wxcloudservice/wxcloudrun/src/development/call/mini.html)
- [微信云托管 MySQL](https://developers.weixin.qq.com/miniprogram/dev/wxcloudservice/wxcloudrun/src/guide/mysql/)
