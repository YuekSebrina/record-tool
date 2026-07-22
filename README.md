# 拾羽

“拾羽”是一个用于随记、待办和书影音记录的微信小程序。

当前仓库处于 Phase 1 可交互原型阶段，业务数据保存在微信本地存储中，尚未接入正式登录、记录 API 和云端数据库。

## 当前功能

- 首页直接创建随记、待办或书影音记录。
- 待办支持完成和重新打开。
- 书影音支持书籍、动漫、电影、韩剧分类与状态。
- 动漫和韩剧支持集数进度及一键 `+1`。
- 首页展示最近 5 条记录。
- 全部记录支持搜索、类型筛选和状态筛选。
- 首页与全部列表点击条目后先显示预览弹窗。
- 详情页支持编辑、完成、更新进度和删除。
- 我的页面展示本地记录数量与微信资料预留入口。

## 技术栈

- 原生微信小程序
- TypeScript
- WXML
- Less
- Glass-Easel 组件框架
- 微信开发者工具 TypeScript/Less 编译插件

## 目录

```text
miniprogram/
  components/       公共导航组件
  pages/            首页、新建、全部、详情、我的
  utils/            原型数据与云托管调用封装
docs/
  phase-1-prototype.md
  development-log.md
```

## 本地预览

1. 使用微信开发者工具打开项目根目录。
2. 确认项目 AppID 为 `wx3bb09833ab3cc2b7`。
3. 点击“编译”进入首页。
4. 使用“随记 / 待办 / 书影音”切换不同录入模式。
5. 本地原型数据可通过开发者工具 Storage 面板查看。

## 数据边界

- 当前记录只保存在本地，不会写入生产 MySQL。
- `miniprogram/utils/cloud-run.ts` 保留了原计数器模板的云托管调用，但当前业务页面不再调用它。
- 后端源码位于 `E:\git_code\record-tool-backend`，目前仍是 Flask/MySQL 计数器模板。
- 微信登录、OpenID 用户映射、云端记录同步将在后续 Phase 实现。

## 文档

- [Phase 1 产品原型与视觉规范](docs/phase-1-prototype.md)
- [开发日志](docs/development-log.md)
- [微信小程序开发文档](https://developers.weixin.qq.com/miniprogram/dev/framework/)
