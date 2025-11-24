# Partnermatic API 完整文档

## 📋 基本信息

- **API 名称**: Partnermatic Transaction API
- **API 地址**: `https://api.partnermatic.com/api/transaction`
- **请求方法**: POST
- **Content-Type**: application/json
- **响应格式**: JSON

---

## 📤 Request Format

### cURL 示例

```bash
curl --location --request POST 'https://api.partnermatic.com/api/transaction' \
--header 'Content-Type: application/json' \
--data-raw '{
  "source": "partnermatic",
  "token": "token",
  "dataScope": "user",
  "beginDate": "2025-06-01",
  "endDate": "2025-06-05",
  "curPage": 1,
  "perPage": 20
}'
```

### 请求体结构

```json
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

---

## 📥 Return Format

### 成功响应示例

```json
{
  "code": "0",
  "message": "success",
  "data": {
    "total": 2,
    "curPage": 1,
    "totalPage": 1,
    "hasNext": false,
    "list": [
      {
        "partnermatic_id": "09dfd2d6300c5d106e0a01dcfabbe3d4",
        "brand_id": "66303",
        "mcid": "ulike0",
        "merchant_name": "Grande Cosmetics",
        "order_id": "6284837257353",
        "order_time": 1749289879,
        "sale_amount": 58.4,
        "sale_comm": 3.26,
        "status": "Pending",
        "norm_id": "58254",
        "ori_amount": 58.4,
        "ori_aff_brokerage": 3.26,
        "prod_id": "126927520",
        "order_unit": 1,
        "uid": "pubid",
        "uid2": null,
        "uid3": null,
        "uid4": null,
        "uid5": null,
        "click_ref": "pb_rwe64s",
        "comm_rate": "Revshare 70.00%",
        "validation_date": null,
        "note": null,
        "customer_country": "US",
        "voucher_code": null,
        "is_direct": 0,
        "channel_id": "PB00225432",
        "last_update_time": "06-08-2025",
        "paid_status": 0,
        "settlement_date": null,
        "paid_date": null
      }
    ]
  }
}
```

---

## 📝 Required Parameters

### 必需参数

| 参数名 | 类型 | 必填 | 说明 | 示例 |
|--------|------|------|------|------|
| source | string | ✅ | 固定值 "partnermatic" | `"partnermatic"` |
| token | string | ✅ | API Token | `"805e9b2e0d7fa712500bb4692db82a16"` |
| beginDate | string | ✅* | 交易开始日期 (YYYY-MM-DD) | `"2025-06-01"` |
| endDate | string | ✅* | 交易结束日期 (YYYY-MM-DD) | `"2025-06-05"` |

*注：beginDate 和 endDate 为必需，除非使用批准日期范围（beginApproveDate 和 endApproveDate）*

### 可选参数

| 参数名 | 类型 | 必填 | 说明 | 默认值 | 示例 |
|--------|------|------|------|--------|------|
| dataScope | string | ❌ | 数据范围：`"channel"` 或 `"user"` | `"user"` | `"user"` |
| beginApproveDate | string | ❌ | 批准开始日期 (YYYY-MM-DD) | - | `"2025-06-01"` |
| endApproveDate | string | ❌ | 批准结束日期 (YYYY-MM-DD) | - | `"2025-06-05"` |
| curPage | number | ❌ | 当前页码（从 1 开始） | `1` | `1` |
| perPage | number | ❌ | 每页记录数 | `20` | `20` |

---

## 📊 Response Parameters

### 顶层响应

| 字段名 | 类型 | 说明 |
|--------|------|------|
| code | string | 响应状态码（0 = 成功） |
| message | string | 响应状态描述（如 "success"） |
| data | object | 主数据容器 |

### data 对象

| 字段名 | 类型 | 说明 |
|--------|------|------|
| total | number | 总记录数 |
| curPage | number | 当前页码（从 1 开始） |
| totalPage | number | 总页数 |
| hasNext | boolean | 是否有下一页 (true/false) |
| list | array | 交易详情数组 |

### list 数组中每条记录的字段

| 字段名 | 类型 | 说明 | 示例 |
|--------|------|------|------|
| partnermatic_id | string | Partnermatic 系统唯一 ID | `"09dfd2d6300c5d106e0a01dcfabbe3d4"` |
| brand_id | string | 品牌 ID，数字串 | `"66303"` |
| mcid | string | 品牌的唯一标识符，字符串 | `"ulike0"` |
| merchant_name | string | 品牌名称 | `"Grande Cosmetics"` |
| order_id | string | 订单 ID | `"6284837257353"` |
| order_time | number | 交易时间（Unix 时间戳） | `1749289879` |
| sale_amount | number | 销售金额 | `58.4` |
| sale_comm | number | 销售佣金 | `3.26` |
| status | string | 佣金状态 | `"Pending"` |
| norm_id | string | 规范 ID | `"58254"` |
| ori_amount | number | 原始金额 | `58.4` |
| ori_aff_brokerage | number | 原始推广佣金 | `3.26` |
| prod_id | string | 产品 ID | `"126927520"` |
| order_unit | number | 订单单位数量 | `1` |
| uid | string \| null | 你的自定义跟踪变量 | `"pubid"` |
| uid2 | string \| null | uid2，你的自定义跟踪变量 | `null` |
| uid3 | string \| null | uid3，你的自定义跟踪变量 | `null` |
| uid4 | string \| null | uid4，你的自定义跟踪变量 | `null` |
| uid5 | string \| null | uid5，你的自定义跟踪变量 | `null` |
| click_ref | string | 唯一点击 ID | `"pb_rwe64s"` |
| comm_rate | string | 佣金率 | `"Revshare 70.00%"` |
| validation_date | string \| null | 交易验证日期 | `null` |
| note | string \| null | 状态变更原因 | `null` |
| customer_country | string | 客户国家。如为空，表示商户不提供 | `"US"` |
| voucher_code | string \| null | 结账时使用的优惠码 | `null` |
| is_direct | number | 是否直链（0/1） | `0` |
| channel_id | string | 渠道 ID | `"PB00225432"` |
| last_update_time | string | 我们从广告商更新交易状态的最新时间 | `"06-08-2025"` |
| paid_status | number | 此交易是否已支付给发布商。1 = 已支付，0 = 未支付 | `0` |
| settlement_date | string \| null | 佣金批准并可提现的日期 | `null` |
| paid_date | string \| null | 标记为已支付的日期。格式：YYYY-MM-DD | `null` |

---

## 🔑 重要说明

### 日期参数规则

1. **交易日期范围**（beginDate/endDate）和**批准日期范围**（beginApproveDate/endApproveDate）至少需要提供一个
2. 如果两个日期范围都提供，将返回同时满足两个条件的记录
3. 日期格式必须为 `YYYY-MM-DD`

### 状态值

- `"Pending"` - 待处理
- 其他状态值根据实际情况而定

### paid_status 值

- `0` - 未支付
- `1` - 已支付

### 空值处理

- 很多字段可能为 `null` 或空字符串
- 前端处理时需要进行空值检查

---

## 💡 使用示例

### 查询特定日期范围的交易

```json
{
  "source": "partnermatic",
  "token": "your_token_here",
  "dataScope": "user",
  "beginDate": "2025-10-01",
  "endDate": "2025-10-31",
  "curPage": 1,
  "perPage": 50
}
```

### 查询已批准的佣金

```json
{
  "source": "partnermatic",
  "token": "your_token_here",
  "dataScope": "user",
  "beginApproveDate": "2025-10-01",
  "endApproveDate": "2025-10-31",
  "curPage": 1,
  "perPage": 50
}
```

---

## 🐛 注意事项

1. **字段名格式**: API 返回的字段名为**下划线格式**（snake_case），不是驼峰格式（camelCase）
2. **时间戳**: order_time 为 Unix 时间戳（秒级）
3. **分页**: curPage 从 1 开始计数
4. **日期**: last_update_time 格式为 `MM-DD-YYYY`
5. **空值**: 很多字段可能为 null 或空字符串，需要做好空值处理

---

## 📞 错误处理

### 响应状态码

- `code: "0"` - 成功
- 其他值表示错误，查看 `message` 字段获取详细错误信息

### 常见错误

1. Token 无效或过期
2. 日期格式错误
3. 网络超时
4. 参数缺失

---

**文档创建时间**: 2025-10-30  
**最后更新**: 2025-10-30

