# LookAny - 联盟业绩监控系统

多联盟佣金业绩监控网站，基于 Next.js + Supabase 构建。

## 功能特性

- ✅ 支持多联盟（Partnermatic、LinkHaitao、LinkBux 等）
- ✅ 支持多账号管理
- ✅ 实时业绩查询
- ✅ 业绩汇总统计
- ✅ 多联盟数据整合展示
- ✅ **数据可视化报告**（新增）
  - 佣金趋势图（折线图）
  - 商户排名图（柱状图）
  - 状态统计图（饼图）
  - 地理分布图（柱状图）
  - 汇总统计卡片
- 🚧 广告商列表管理（待实现）
- 🚧 Excel 数据导入（待实现）

## 技术栈

- **前端**: Next.js 14 (App Router), React 18, TypeScript
- **后端**: Next.js API Routes
- **数据库**: Supabase (PostgreSQL)
- **图表库**: Recharts
- **HTTP 客户端**: Axios

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置 Supabase

1. 在 [Supabase](https://supabase.com) 创建新项目
2. 执行 `supabase/schema.sql` 创建数据库表结构
3. 复制 `env.local.example` 为 `.env.local`
4. 填入 Supabase 项目配置：

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 3. 配置联盟数据

在 Supabase Dashboard 中：

1. 进入 `network_configs` 表，确保有联盟配置
2. 进入 `network_accounts` 表，添加账号及对应 token

### 4. 启动开发服务器

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000)

## 数据库结构

### network_configs（联盟配置表）
- `id`: UUID 主键
- `name`: 联盟名称
- `type`: 联盟类型 (partnermatic/linkhaitao/linkbux)
- `api_url`: API 地址
- `is_active`: 是否启用

### network_accounts（联盟账号表）
- `id`: UUID 主键
- `network_id`: 关联的联盟 ID
- `token`: API Token
- `account_name`: 账号名称
- `is_active`: 是否启用

### merchants（广告商表）
- `id`: UUID 主键
- `name`: 广告商名称
- `website`: 网址
- `description`: 描述
- `mcid`: 商户 ID
- `brand_id`: 品牌 ID

## API 使用说明

### 查询业绩

```bash
POST /api/commissions
Content-Type: application/json

{
  "networkIds": [],  // 空数组表示所有联盟
  "beginDate": "2025-06-01",
  "endDate": "2025-06-05",
  "curPage": 1,
  "perPage": 20
}
```

## 开发计划

- [x] 基础项目架构
- [x] Supabase 集成
- [x] Partnermatic API 对接
- [x] 数据可视化报告（✅ 已完成）
- [ ] LinkHaitao API 对接
- [ ] LinkBux API 对接
- [ ] 联盟管理界面
- [ ] 账号管理界面
- [ ] Excel 导入功能
- [ ] 广告商数据管理

## 文档

- **项目总结**: [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md) - 包含完整安装、配置、调试指南
- **API 文档**: [docs/Partnermatic-API-Documentation.md](docs/Partnermatic-API-Documentation.md) - Partnermatic API 完整规范
- **Token 添加**: [INSERT_PARTNERMATIC_TOKEN.sql](INSERT_PARTNERMATIC_TOKEN.sql) - SQL 脚本示例

## License

MIT

