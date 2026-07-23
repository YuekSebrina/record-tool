# 拾羽

“拾羽”是一个私人书影音收藏夹微信小程序，固定管理书籍、动漫、电影和剧集四类收藏。

## 当前功能

- 按书籍、动漫、电影或剧集搜索豆瓣条目。
- 展示标题、封面、年份、作者、副标题、集数和豆瓣来源链接等可用信息。
- 一键保存到对应分类，自动避免同分类重复收藏。
- 按四类查看本地收藏数量，支持列表与三列海报宫格布局。
- 每项可以设置 1–5 星个人评分及已看/总集数（书籍为已读/总页数）进度。
- 输入进度后自动计算并显示百分比进度条。
- 收藏、评分和导航操作提供轻震反馈。
- 支持复制豆瓣链接及二次确认后移出收藏。
- 豆瓣封面通过 Flask 后端代理，并在小程序端限制数量缓存。

## 页面

| 页面 | 路由 | 作用 |
| --- | --- | --- |
| 搜索 | `pages/index/index` | 选择分类、联网搜索并收藏 |
| 收藏 | `pages/records/records` | 分类查看和删除已收藏条目 |

底部导航固定为“搜索 / 收藏”。原随记、待办、新建、详情和我的页面已从运行路由移除，源码暂时保留供后续清理参考。

## 数据流

```text
小程序
→ 微信云托管 Flask 服务
→ 豆瓣 subject_suggest 接口
→ 统一搜索结果

小程序
→ Flask /api/image
→ 豆瓣图片（带 Referer）
→ 小程序本地封面缓存
```

收藏数据保存在微信本地 Storage 的 `favorite-catalog-items-v1` 中，目前不做账号登录和跨设备同步。

## 后端

后端由独立的 Flask 项目维护，需要将对应版本部署到当前云托管服务：

- 环境：`prod-d8gf33lii77ef34ef`
- 服务：`flask-tddl`
- `GET /api/health`
- `GET /api/search?q=关键词&type=book|anime|movie|series`
- `GET /api/detail?id=豆瓣条目ID&type=book|anime|movie|series`
- `GET /api/image?url=豆瓣图片地址`

书籍搜索使用 `book.douban.com/j/subject_suggest`，其余分类使用 `movie.douban.com/j/subject_suggest`。搜索接口提供基础结果，条目简介、评分、类型和主创在打开详情时通过详情接口补充；上游未提供的字段保持为空，不生成虚假数据。

## 本地预览

1. 先部署后端修改到上述微信云托管服务。
2. 执行 `npm install` 安装 TDesign 小程序组件库。
3. 使用微信开发者工具打开项目根目录，并执行“工具 → 构建 npm”。
4. 确认 AppID 为 `wx3bb09833ab3cc2b7`。
5. 编译后在搜索页输入作品名称进行测试。

## 技术栈

- 原生微信小程序
- TypeScript、WXML、Less
- TDesign MiniProgram
- Glass-Easel、Skyline
- Flask、微信云托管
