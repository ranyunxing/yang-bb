# SQL 脚本说明

## 需要执行的 SQL 文件

### ✅ `setup_merchants_system.sql` - **主要脚本（必须执行）**

这个脚本包含所有必要的数据库修改：

1. **修改 merchants 表结构**
   - 删除不需要的字段（description, category）
   - 添加新字段（offer_type, country, support_region, relationship, tracking_url_short, website_domain）
   - 创建/更新索引
   - 重新创建 merchants_view 视图

2. **添加广告商 API URL 字段**
   - 在 `network_configs` 表中添加 `merchant_api_url` 字段
   - 更新 Partnermatic 的广告商 API URL 为 `https://api.partnermatic.com/api/monetization`

3. **验证结果**
   - 显示更新后的配置
   - 验证表结构和索引

**重要说明：**
- ✅ **不会影响佣金系统**：佣金系统使用 `api_url` 字段（`https://api.partnermatic.com/api/transaction`）
- ✅ **广告商系统使用新字段**：`merchant_api_url` 字段（`https://api.partnermatic.com/api/monetization`）
- ✅ **两个字段互不干扰**：它们是独立的字段

### 📝 `update_partnermatic_token.sql` - **可选脚本**

如果需要更新 Partnermatic 账号的 token，可以执行此脚本。

**使用方法：**
1. 先查看现有账号：执行脚本中的"方法 2"查询
2. 根据账号名称更新 token：修改脚本中的账号名称后执行"方法 1"

## 增量脚本

- 🧩 `add_website_domain.sql`：如果早期已经执行过旧版本脚本，只需执行该文件即可补充 `website_domain` 字段和索引。

## 不需要的 SQL 文件（可以删除）

- ❌ `update_partnermatic_account.sql` - 功能与 `update_partnermatic_token.sql` 重复
- ❌ `add_merchant_api_url.sql` - 已合并到 `setup_merchants_system.sql`
- ❌ `update_merchants_table.sql` - 已合并到 `setup_merchants_system.sql`

## 执行顺序

1. **第一步**：执行 `setup_merchants_system.sql`
   ```sql
   -- 在 Supabase Dashboard 的 SQL Editor 中执行
   ```

2. **第二步（可选）**：如果需要更新 token，执行 `update_partnermatic_token.sql`
   ```sql
   -- 先查看账号，然后更新 token
   ```

## 验证

执行完 `setup_merchants_system.sql` 后，运行以下查询验证：

```sql
-- 验证 API URL 配置
SELECT 
  name,
  type,
  api_url AS commission_api_url,
  merchant_api_url,
  is_active
FROM network_configs
WHERE type = 'partnermatic';

-- 应该看到：
-- commission_api_url: https://api.partnermatic.com/api/transaction
-- merchant_api_url: https://api.partnermatic.com/api/monetization
```

## 常见问题

**Q: 添加 merchant_api_url 会影响佣金系统吗？**
A: 不会。佣金系统只读取 `api_url` 字段，广告商系统读取 `merchant_api_url` 字段，两者互不干扰。

**Q: 如果已经执行过部分 SQL 怎么办？**
A: 所有 SQL 都使用了 `IF NOT EXISTS` 和 `IF EXISTS`，可以安全地重复执行。

**Q: 如何更新其他联盟的广告商 API URL？**
A: 在 `network_configs` 表中更新对应联盟的 `merchant_api_url` 字段即可。

