// 联盟类型
export type NetworkType = 'linkhaitao' | 'partnermatic' | 'linkbux' | 'other'

// 联盟配置
export interface NetworkConfig {
  id: string
  name: string
  type: NetworkType
  apiUrl: string // 佣金报告 API URL
  merchantApiUrl?: string // 广告商 API URL（可选）
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// 联盟账号 Token
export interface NetworkAccount {
  id: string
  networkId: string
  token: string
  accountName: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// Partnermatic 返回的业绩数据
// 注意：API 返回的字段名为下划线格式（snake_case），但为了代码一致性，我们使用驼峰格式
// 转换函数会自动处理两种格式的兼容
export interface PartnermaticTransaction {
  // 两种格式都支持
  partnermatic_id?: string  // API 实际字段名
  partnermaticId?: string   // 备用字段名
  
  mcid: string
  merchant_name?: string    // API 实际字段名
  merchantName?: string     // 备用字段名
  
  order_id?: string         // API 实际字段名
  orderId?: string          // 备用字段名
  
  order_time?: number       // API 实际字段名
  orderTime?: number        // 备用字段名
  
  sale_amount?: number      // API 实际字段名
  saleAmount?: number       // 备用字段名
  
  sale_comm?: number        // API 实际字段名
  saleComm?: number         // 备用字段名
  
  status: string
  
  norm_id?: string          // API 实际字段名
  normId?: string           // 备用字段名
  
  ori_amount?: number       // API 实际字段名
  oriAmount?: number        // 备用字段名
  
  ori_aff_brokerage?: number  // API 实际字段名
  oriAffBrokerage?: number    // 备用字段名
  
  prod_id?: string          // API 实际字段名
  prodId?: string           // 备用字段名
  
  order_unit?: number       // API 实际字段名
  orderUnit?: number        // 备用字段名
  
  uid: string | null
  uid2: string | null
  uid3: string | null
  uid4: string | null
  uid5: string | null
  
  click_ref?: string        // API 实际字段名
  clickRef?: string         // 备用字段名
  
  comm_rate?: string        // API 实际字段名
  commRate?: string         // 备用字段名
  
  validation_date?: string | null  // API 实际字段名
  validationDate?: string | null   // 备用字段名
  
  note: string | null
  
  customer_country?: string  // API 实际字段名
  customerCountry?: string   // 备用字段名
  
  voucher_code?: string | null   // API 实际字段名
  voucherCode?: string | null    // 备用字段名
  
  is_direct?: number        // API 实际字段名
  isDirect?: number         // 备用字段名
  
  channel_id?: string       // API 实际字段名
  channelId?: string        // 备用字段名
  
  brand_id?: string         // API 实际字段名
  brandId?: string          // 备用字段名
  
  last_update_time?: string // API 实际字段名
  lastUpdateTime?: string   // 备用字段名
  
  paid_status?: number      // API 实际字段名
  paidStatus?: number       // 备用字段名
  
  settlement_date?: string | null  // API 实际字段名
  settlementDate?: string | null   // 备用字段名
  
  paid_date?: string | null        // API 实际字段名
  paidDate?: string | null         // 备用字段名
}

// Partnermatic API 响应
export interface PartnermaticResponse {
  code: string
  message: string
  data: {
    total: number
    curPage: number
    totalPage: number
    hasNext: boolean
    list: PartnermaticTransaction[]
  }
}

// Partnermatic API 请求参数
export interface PartnermaticRequest {
  source: 'partnermatic'
  token: string
  dataScope?: 'channel' | 'user'
  beginDate: string
  endDate: string
  curPage?: number
  perPage?: number
  // 可选过滤参数
  orderId?: string
  status?: string[]
  uid?: string
  brandId?: string
  mcid?: string
}

// Linkhaitao 返回的业绩数据
export interface LinkhaitaoTransaction {
  sign_id?: string
  m_id?: string
  mcid?: string
  advertiser_name?: string
  order_id?: string
  order_time?: string | number // 时间戳（字符串或数字格式）
  report_time?: string | number
  sale_amount?: string | number
  cashback?: string | number
  status?: string
  refusal_reason?: string
  tagcode?: string
  tagcode2?: string
  rebate?: string
  maketool?: string
  productID?: string
  voucher_code?: string
  num?: string
  referer_url?: string
  cross_device?: string
  [key: string]: any // 其他字段
}

// Linkhaitao API 响应
export interface LinkhaitaoResponse {
  offset?: number
  per_page?: number
  status: {
    code: number
    msg: string
  }
  data: {
    list: LinkhaitaoTransaction[]
    total: {
      total_items: number
      per_page: number
      total_page: number
      nowpage: number
    }
  }
}

// Linkhaitao API 请求参数
export interface LinkhaitaoRequest {
  source: 'linkhaitao'
  token: string
  beginDate: string
  endDate: string
  curPage?: number
  perPage?: number
  // 可选过滤参数
  datetype?: 'eventupdate' | 'transactiondate' // 日期类型：订单更新时间 | 交易时间
  order_id?: string
  status?: string // 订单状态：untreated, expired, effective, all
  tag?: string
  tag2?: string
  page?: number
  per_page?: number
}

// Linkbux Transaction 数据（transaction_v2 API 返回的扁平结构）
export interface LinkbuxTransaction {
  linkbux_id: string // Linkbux system unique ID
  mid?: string // MID
  mcid?: string // Merchant ID
  merchant_name?: string // Merchant Name
  offer_type?: string // Merchant pricing model
  order_id?: string // Order ID
  order_time: string | number // Transaction Time (时间戳，字符串或数字格式)
  sale_amount: string | number // Sale Amount
  sale_comm: string | number // Sale Commission
  status: string // Commission Status: Pending/Approved/Rejected
  uid?: string // uid, your custom tracking variable
  uid2?: string // uid2, your custom tracking variable
  click_ref?: string // A unique order reference identification
  referer_url?: string // The URL of the referring page
  prod_id?: string // Product ID
  order_unit?: string | number // Order Unit Amount
  comm_rate?: string // Commission Rate
  validation_date?: string // Date the transaction validated (YYYY-MM-DD)
  note?: string // Reason for status change
  customer_country?: string // Customer country
  voucher_code?: string // Code used at checkout
  payment_id?: string // The payment ID found under payment history
  settlement_id?: string // A unique ID that indicates approved commission by merchant
  ip?: string // IP Address
  click_time?: string | number // Click Time (时间戳，字符串或数字格式)
  [key: string]: any // 其他字段
}

// Linkbux API 响应 (transaction_v2)
export interface LinkbuxResponse {
  status: {
    code: number // 0=成功，其他为错误码
    msg: string
  }
  data: {
    total_page: number // Total number of pages
    total_trans: string | number // Total number of sales transactions
    total_items: string | number // Total transactions broken down by items
    limit: number // Number of transactions shown per page
    list: LinkbuxTransaction[] // Transaction list
  }
}

// Linkbux API 请求参数 (transaction_v2)
export interface LinkbuxRequest {
  source: 'linkbux'
  token: string
  // 两组日期参数二选一（根据 API 文档，不能同时使用）
  beginDate?: string // 交易日期开始（Transaction period，格式：YYYY-MM-DD）
  endDate?: string // 交易日期结束（Transaction period，格式：YYYY-MM-DD）
  validationDateBegin?: string // 验证日期开始（Validation period，格式：YYYY-MM-DD，与 beginDate 不能同时使用）
  validationDateEnd?: string // 验证日期结束（Validation period，格式：YYYY-MM-DD）
  // 可选过滤参数
  order_id?: string // Order ID
  status?: string // Commission Status: Approved/Pending/Rejected/All
  uid?: string // uid, your custom tracking variable (Max 200 characters)
  uid2?: string // uid2, your custom tracking variable (Max 200 characters)
  mcid?: string // Merchant ID
  offer_type?: string // Merchant pricing model: CPS/CPC/CPA
  payment_id?: string // The payment ID found under payment history
  settlement_id?: string // A unique ID that indicates approved commission by merchant
  page?: number // Current page index
  limit?: number // Number of transactions shown per page - max 2,000 transactions per page
}

// 统一的业绩数据格式（不同联盟都转换为这个格式）
export interface UnifiedCommission {
  id: string // 唯一标识
  networkId: string // 联盟ID
  networkType: NetworkType // 联盟类型
  accountId: string // 账号ID
  orderId: string // 订单ID（不再显示，但保留数据）
  orderTime: number // 订单时间戳
  merchantName: string // 商家名称
  saleAmount: number // 销售额
  commission: number // 佣金
  status: string // 状态
  currency?: string // 币种
  customerCountry?: string // 客户国家
  brandId?: string // 品牌ID
  mcid?: string // MCID
  paidStatus?: number // 支付状态：0=未支付，1=已支付
  [key: string]: any // 其他字段
}

// 业绩查询参数
export interface CommissionQueryParams {
  networkIds?: string[] // 要查询的联盟ID列表，空数组表示所有联盟
  accountIds?: string[] // 要查询的账号ID列表，空数组表示所有账号
  beginDate: string
  endDate: string
  curPage?: number
  perPage?: number
  // 筛选参数
  merchantName?: string // 商家名称筛选
  mcid?: string // MCID 筛选
  status?: string // 状态筛选：全部/Pending/Approved/Rejected
  paidStatus?: string // 支付状态筛选：全部/已支付/未支付
}

// 业绩汇总结果
export interface CommissionSummary {
  total: number // 总条数
  curPage: number // 当前页
  totalPage: number // 总页数
  hasNext: boolean // 是否有下一页
  data: UnifiedCommission[] // 数据列表
  summary: {
    totalAmount: number // 总销售额
    totalCommission: number // 总佣金
    networks: {
      [networkId: string]: {
        networkName?: string // 联盟名称
        amount: number
        commission: number
        accounts: {
          [accountId: string]: {
            accountName?: string // 账号名称
            amount: number
            commission: number
          }
        }
      }
    }
  }
  meta: CommissionMeta // 执行元数据
}

export interface CommissionMeta {
  success: boolean
  errors: string[]
  warnings?: string[]
  infos?: string[]
}

// Partnermatic 广告商数据（Ad Monetization API 返回）
export interface PartnermaticMerchant {
  mcid: string
  merchant_name: string
  site_url?: string
  brand_id?: string
  offer_type?: string
  country?: string
  support_region?: string
  relationship?: string
  tracking_url_short?: string
  [key: string]: any
}

// Partnermatic 广告商 API 响应
export interface PartnermaticMerchantResponse {
  code: string
  message: string
  data: {
    total_mcid: number
    total_page: number
    list: PartnermaticMerchant[]
  }
}

// Partnermatic 广告商 API 请求参数
export interface PartnermaticMerchantRequest {
  source: 'partnermatic'
  token: string
  curPage?: number
  perPage?: number
  relationship?: string // 可选，不传则获取所有
}

// 广告商数据（数据库存储格式）
export interface Merchant {
  id: string
  name: string
  website?: string
  websiteDomain?: string
  networkId?: string
  accountId?: string // 关联的账号ID（重要：每个账号的广告商列表不同）
  mcid?: string // 商户代码
  brandId?: string // 品牌ID
  offerType?: string // 报价类型
  country?: string // 国家
  supportRegion?: string // 支持区域
  relationship?: string // 关系类型
  trackingUrlShort?: string // 短链接
  createdAt?: string
  updatedAt?: string
  // 视图字段（通过 JOIN 获取）
  networkName?: string
  accountName?: string
}

// 广告商搜索参数
export interface MerchantSearchParams {
  query?: string // 搜索关键词（URL、名称、MCID、品牌ID）
  networkId?: string
  accountId?: string
  limit?: number
  offset?: number
}

// 广告商同步结果
export interface MerchantSyncResult {
  success: boolean
  totalAccounts: number
  successAccounts: number
  failedAccounts: number
  totalMerchants: number
  errors: Array<{
    accountId: string
    accountName: string
    error: string
  }>
}

