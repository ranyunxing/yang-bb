# LookAny 项目完整文档

## 🎯 项目概述

多联盟佣金业绩监控系统，基于 Next.js + Supabase + Recharts 构建。

## ✅ 已完成功能

1. **多联盟支持**：Partnermatic（已实现）、LinkHaitao、LinkBux 架构
2. **账号管理**：数据库存储 Token，不硬编码
3. **实时查询**：调用各联盟 API 获取实时数据
4. **数据可视化**：趋势图、排行图、状态分布图、地理分布图
5. **日期快速选择**：今天、昨天、近7天、近30天、本月、上月
6. **联盟筛选**：可选择查看全部或特定联盟
7. **账号筛选**：可选择查看全部或特定账号的业绩
8. **命名显示**：显示联盟名称和账号名称，而非 UUID
9. **数据筛选**：支持按商家名称、MCID、状态、支付状态筛选
10. **浏览器调试**：F12 Console 详细调试信息

## 🐛 已修复问题

### 1. 数据库字段映射（2025-10-30）
- **问题**：数据库用 snake_case，代码期望 camelCase
- **修复**：添加手动字段转换
- **文件**：`lib/api/networks.ts`, `lib/api/commission-manager.ts`

### 2. 日期时区问题（2025-10-30）
- **问题**：`toISOString()` 导致日期偏移
- **修复**：使用本地时区格式化
- **文件**：`components/CommissionMonitor.tsx`

### 3. 空值错误（2025-10-30）
- **问题**：`toFixed()` 在 null 上调用报错
- **修复**：添加空值检查 `(value || 0).toFixed(2)`

### 4. 日期有效性检查（2025-10-30）
- **问题**：无效时间戳导致 `RangeError: Invalid time value`
- **修复**：添加日期验证和异常处理

### 5. API 字段映射错误（2025-10-30）
- **问题**：Partnermatic API 返回 snake_case (`sale_amount`, `sale_comm`)，代码期望 camelCase
- **修复**：`transformPartnermaticToUnified` 优先使用 camelCase，降级到 snake_case
- **文件**：`lib/api/networks/partnermatic.ts`

### 6. UUID 显示问题（2025-10-30）
- **问题**：联盟和账号显示 UUID 而非友好名称
- **修复**：在 summary 中添加 `networkName` 和 `accountName` 映射，页面显示名称
- **文件**：`types/index.ts`, `lib/api/commission-manager.ts`, `components/CommissionMonitor.tsx`

### 7. 业绩明细表格优化（2025-10-30）
- **问题**：表格显示字段不够丰富，缺少筛选功能
- **修复**：
  - 移除订单ID列
  - 商户改为商家名称
  - 新增品牌ID、MCID、支付状态列
  - 支持按商家名称、MCID、状态、支付状态筛选
  - 支付状态：0=未支付（红色），1=已支付（绿色）
- **文件**：`types/index.ts`, `lib/api/networks/partnermatic.ts`, `lib/api/commission-manager.ts`, `components/CommissionMonitor.tsx`, `components/CommissionMonitor.module.css`

## 📋 安装与配置

### 第一步：初始化项目

```bash
npm install
```

### 第二步：创建 Supabase 项目

1. 访问 [https://supabase.com](https://supabase.com)
2. 注册账号并创建新项目
3. 记录以下信息：
   - Project URL
   - Anon Key
   - Service Role Key（在 Project Settings → API 中）

### 第三步：配置环境变量

复制环境变量模板：
```bash
cp env.local.example .env.local
```

编辑 `.env.local`：
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

### 第四步：配置数据库

#### 1. 执行 SQL 脚本

在 Supabase Dashboard → SQL Editor：
1. 复制 `supabase/schema.sql` 的内容
2. 执行 SQL

#### 2. 添加 Token 到数据库

**方法 A：通过 Table Editor（推荐）**

1. 进入 Table Editor → `network_accounts`
2. 获取联盟 ID：切换到 `network_configs` 表，复制 Partnermatic 的 `id`
3. 点击 Insert 按钮，填写：
   - `network_id`: 粘贴联盟 ID
   - `token`: 你的 Partnermatic API Token
   - `account_name`: 账号名称
   - `is_active`: 勾选

**方法 B：通过 SQL Editor**

```sql
-- 1. 查询联盟 ID
SELECT id, name FROM network_configs WHERE type = 'partnermatic';

-- 2. 插入账号（替换为你的实际值）
INSERT INTO network_accounts (network_id, token, account_name, is_active)
SELECT 
    id,
    '你的真实token',              -- ⚠️ 替换这里
    '我的 Partnermatic 账号',     -- ⚠️ 替换这里
    true
FROM network_configs 
WHERE type = 'partnermatic' 
LIMIT 1;
```

#### 3. 验证数据

```sql
SELECT * FROM network_accounts_view;
```

### 第五步：启动项目

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000)

## 🗂️ 数据库结构

### 表 1: network_configs（联盟配置表）

| 列名 | 类型 | 说明 |
|------|------|------|
| id | UUID | 联盟ID（主键）|
| name | VARCHAR(100) | 联盟名称 |
| type | VARCHAR(50) | 联盟类型 |
| api_url | TEXT | API 地址 |
| is_active | BOOLEAN | 是否启用 |

**要点**：每个联盟有自己的 `api_url`，所有该联盟的账号共用同一个 URL

### 表 2: network_accounts（联盟账号表）

| 列名 | 类型 | 说明 |
|------|------|------|
| id | UUID | 账号ID（主键）|
| network_id | UUID | 所属联盟ID（外键）|
| token | TEXT | API Token |
| account_name | VARCHAR(200) | 账号名称 |
| is_active | BOOLEAN | 是否启用 |

**要点**：一个联盟可以有多个账号，每个账号有不同的 token

### 表 3: merchants（广告商表）

| 列名 | 类型 | 说明 |
|------|------|------|
| id | UUID | 广告商ID（主键）|
| name | VARCHAR(200) | 广告商名称 |
| network_id | UUID | 所属联盟ID |
| **account_id** | UUID | **所属账号ID** |
| mcid | VARCHAR(100) | 商户代码 |

**要点**：每个账号有独立的广告商列表

### 关系图

```
network_configs (联盟)
  ↓ 一个联盟有多个账号
network_accounts (账号)
  ↓ 一个账号有多个广告商
merchants (广告商)
```

### 视图（View）

为了更直观地查看数据，SQL 脚本创建了两个视图：

**network_accounts_view**：显示联盟名称而不是 UUID
```sql
SELECT * FROM network_accounts_view;
```

**merchants_view**：显示联盟和账号名称
```sql
SELECT * FROM merchants_view;
```

## 🎨 可视化功能

### 汇总统计卡片
- 💰 总销售额
- 💵 总佣金
- 📦 订单数
- 📊 平均佣金

### 图表类型

1. **趋势分析**：双折线图，按日期显示销售和佣金趋势
2. **商户排名**：横向柱状图，Top 10 商户佣金排行
3. **状态统计**：饼图，订单状态分布
4. **地理分布**：柱状图，Top 10 佣金来源国家

### 使用方法

1. 选择日期范围（可快速选择或自定义）
2. 点击"查询业绩"
3. 查看数据和图表
4. 使用标签页切换不同图表

## 🔍 调试指南

### 浏览器调试（F12）

1. **打开开发者工具**：按 F12
2. **查看 Console**：
   - 查找 "🐛 LookAny Debug Info" 分组
   - 查看数据状态、错误信息、样本数据
3. **调试面板**：
   - 页面右下角显示/隐藏调试按钮
   - 点击查看 JSON 格式的详细信息
4. **网络请求**：
   - Network 标签
   - 查看 `/api/commissions` 和 `/api/networks`
   - 检查请求参数和响应

### 服务器调试

**Vercel Logs**：
- Dashboard → Functions → Logs
- 搜索：`📊`, `🔗`, `👤`, `📡`, `✅`

**Supabase Logs**：
- Dashboard → Logs & Analytics
- 查看 API Gateway 和 Postgres 日志

### 常见问题排查

#### 暂无数据
- ✅ 检查 Console 是否有错误
- ✅ 检查 Token 是否正确
- ✅ 检查日期范围是否有数据
- ✅ 验证数据库配置

#### API 错误
- ✅ 查看服务器日志详细错误
- ✅ 检查网络请求响应状态码
- ✅ 验证 API 参数格式

#### 日期错误
- ✅ 检查 "Invalid time value" 错误
- ✅ 验证时间戳格式
- ✅ 检查是否有空值

## 📊 API 规范

详细的 API 文档请查看：[Partnermatic API 文档](docs/Partnermatic-API-Documentation.md)

### Partnermatic API 快速参考

**请求格式**：
```bash
POST https://api.partnermatic.com/api/transaction
Content-Type: application/json

{
  "source": "partnermatic",
  "token": "token",
  "dataScope": "user",
  "beginDate": "2025-06-01",
  "endDate": "2025-06-05",
  "curPage": 1,
  "perPage": 20
}
```

**响应格式**：
```json
{
  "code": "0",
  "message": "success",
  "data": {
    "total": 2,
    "curPage": 1,
    "totalPage": 1,
    "hasNext": false,
    "list": [...]
  }
}
```

**重要**: API 返回的字段名为**下划线格式**（snake_case），如 `sale_amount`、`order_time` 等

## 📁 核心文件

```
app/
  ├── api/
  │   ├── commissions/route.ts    # 业绩查询 API
  │   └── networks/route.ts       # 联盟列表 API
  ├── page.tsx                    # 首页
  └── layout.tsx                  # 布局
components/
  ├── CommissionMonitor.tsx       # 查询界面
  ├── CommissionReport.tsx        # 可视化图表
  └── DebugPanel.tsx             # 调试面板
lib/
  ├── api/
  │   ├── commission-manager.ts   # 统一业绩管理
  │   ├── networks.ts             # 联盟配置
  │   └── networks/partnermatic.ts
  └── supabase/
      ├── client.ts               # 客户端
      └── server.ts               # 服务端
types/index.ts                    # TypeScript 类型
supabase/schema.sql               # 数据库结构
```

## 🚀 部署

### Vercel 部署

1. 推送代码到 Git 仓库
2. 在 Vercel 导入项目
3. 配置环境变量
4. 自动部署

### 环境变量配置

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## 🔮 待实现功能

- [ ] 按账号筛选数据
- [ ] LinkHaitao API 对接
- [ ] LinkBux API 对接
- [ ] Excel 导入
- [ ] 广告商管理
- [ ] 数据缓存
- [ ] 更多图表类型

## 📞 技术支持

遇到问题：
1. 查看 F12 Console 调试信息
2. 检查 Vercel Function Logs
3. 验证数据库配置
4. 确认 API Token 正确

---

**最后更新**: 2025-10-30  
**版本**: 1.0.0
