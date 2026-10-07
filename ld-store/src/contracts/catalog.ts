import {
  array,
  boolean,
  integer,
  literal,
  looseObject,
  minLength,
  minValue,
  nullable,
  null_,
  number,
  optional,
  pipe,
  regex,
  string,
  transform,
  union,
  unknown,
  type InferOutput
} from 'valibot'

const PositiveIntegerSchema = pipe(number(), integer(), minValue(1))
const NonnegativeIntegerSchema = pipe(number(), integer(), minValue(0))
const NumericIdStringSchema = pipe(string(), regex(/^[1-9]\d*$/))
const EntityIdSchema = union([PositiveIntegerSchema, NumericIdStringSchema])
const NonemptyStringSchema = pipe(string(), minLength(1))

export const PostgreSqlCountSchema = union([
  NonnegativeIntegerSchema,
  pipe(string(), regex(/^\d+$/), transform(Number))
])

export const PaginationSchema = looseObject({
  total: NonnegativeIntegerSchema,
  page: PositiveIntegerSchema,
  pageSize: PositiveIntegerSchema,
  totalPages: NonnegativeIntegerSchema,
  hasMore: optional(boolean()),
  nextCursor: optional(nullable(string()))
})

export const PostgreSqlCountPaginationSchema = looseObject({
  total: PostgreSqlCountSchema,
  page: PositiveIntegerSchema,
  pageSize: PositiveIntegerSchema,
  totalPages: NonnegativeIntegerSchema,
  hasMore: optional(boolean()),
  nextCursor: optional(nullable(string()))
})

export const CategorySchema = looseObject({
  id: EntityIdSchema,
  name: NonemptyStringSchema,
  icon: optional(nullable(string())),
  visibilityTrustLevel: optional(nullable(number()))
})

export const ProductSchema = looseObject({
  id: EntityIdSchema,
  name: NonemptyStringSchema,
  categoryId: optional(nullable(union([number(), string()]))),
  categoryName: optional(nullable(string())),
  productType: optional(string()),
  status: optional(string()),
  price: optional(union([number(), string()])),
  finalPrice: optional(union([number(), string()])),
  stock: optional(number()),
  availableStock: optional(number()),
  sellerUsername: optional(nullable(string())),
  discoveryToken: optional(string())
})

export const RankingContextSchema = looseObject({
  surface: NonemptyStringSchema,
  version: NonemptyStringSchema,
  fallback: boolean(),
  requestId: optional(string()),
  slateId: optional(string()),
  releaseMode: optional(string()),
  statsComputedAt: optional(nullable(union([number(), string()])))
})

export const CategoriesResponseSchema = looseObject({
  categories: array(CategorySchema)
})

export const ProductListCoreResponseSchema = looseObject({
  products: array(ProductSchema),
  pagination: PaginationSchema,
  rankingContext: optional(unknown()),
  searchMeta: optional(looseObject({
    normalizedQuery: optional(string()),
    zeroResult: optional(boolean())
  })),
  cursorRestarted: optional(boolean())
})

export const ProductListResponseSchema = looseObject({
  products: array(ProductSchema),
  pagination: PaginationSchema,
  rankingContext: optional(RankingContextSchema),
  searchMeta: optional(looseObject({
    normalizedQuery: optional(string()),
    zeroResult: optional(boolean())
  })),
  cursorRestarted: optional(boolean())
})

export const ProductDetailResponseSchema = looseObject({
  product: ProductSchema
})

export const MerchantProfileResponseSchema = looseObject({
  merchant: looseObject({
    username: NonemptyStringSchema,
    userId: optional(union([number(), string()])),
    trustLevel: optional(number())
  }),
  profile: optional(nullable(looseObject({}))),
  stats: looseObject({
    onlineCount: NonnegativeIntegerSchema,
    totalListedCount: NonnegativeIntegerSchema,
    totalSoldCount: NonnegativeIntegerSchema
  }),
  products: optional(array(ProductSchema))
})

const ModerationStatusSchema = union([
  literal('pending'),
  literal('pending_ai'),
  literal('pending_manual'),
  literal('ai_approved'),
  literal('manual_approved'),
  literal('approved'),
  literal('ai_rejected'),
  literal('manual_rejected'),
  literal('rejected')
])

export const CommentSchema = looseObject({
  id: EntityIdSchema,
  content: NonemptyStringSchema,
  status: ModerationStatusSchema,
  productId: optional(union([number(), string()])),
  replyCount: optional(NonnegativeIntegerSchema)
})

export const CommentReplySchema = looseObject({
  id: EntityIdSchema,
  content: NonemptyStringSchema,
  status: ModerationStatusSchema,
  commentId: optional(union([number(), string()]))
})

export const ProductCommentsResponseSchema = looseObject({
  commentEnabled: boolean(),
  viewerHasPurchased: boolean(),
  comments: array(CommentSchema),
  pagination: PaginationSchema,
  summary: looseObject({})
})

export const CommentRepliesResponseSchema = looseObject({
  replies: array(CommentReplySchema),
  pagination: PaginationSchema
})

export const CommentCreatedResponseSchema = looseObject({
  comment: CommentSchema,
  message: optional(string())
})

export const CommentReplyCreatedResponseSchema = looseObject({
  reply: CommentReplySchema,
  replyCount: optional(NonnegativeIntegerSchema)
})

export const CommentVoteResponseSchema = looseObject({
  viewerVote: string(),
  upvoteCount: NonnegativeIntegerSchema,
  downvoteCount: NonnegativeIntegerSchema
})

export const ProductReportSchema = looseObject({
  id: EntityIdSchema,
  status: NonemptyStringSchema
})

export const ProductReportsResponseSchema = looseObject({
  reports: array(ProductReportSchema),
  pagination: PaginationSchema
})

export const ProductReportDetailResponseSchema = looseObject({
  report: ProductReportSchema,
  logs: array(looseObject({})),
  relatedReports: optional(array(ProductReportSchema))
})

export const ProductReportCreatedResponseSchema = union([
  looseObject({ reportId: EntityIdSchema }),
  looseObject({ report: ProductReportSchema })
])

export const ProductCollectionResponseSchema = looseObject({
  products: array(ProductSchema),
  pagination: PaginationSchema
})

export const RestockSubscriptionResponseSchema = looseObject({
  subscribed: boolean(),
  productId: optional(union([number(), string()])),
  canSubscribe: optional(boolean()),
  outOfStock: optional(boolean())
})

export const ActionAcknowledgementSchema = union([null_(), looseObject({})])

export const ShopSchema = looseObject({
  id: EntityIdSchema,
  name: NonemptyStringSchema,
  status: optional(string())
})

export const MarketplaceShopsResponseSchema = looseObject({
  shops: array(ShopSchema),
  pagination: PaginationSchema
})

const BuyRequestStatusSchema = union([
  literal('pending_review'),
  literal('open'),
  literal('negotiating'),
  literal('matched'),
  literal('closed'),
  literal('blocked')
])

export const BuyRequestSchema = looseObject({
  id: EntityIdSchema,
  title: NonemptyStringSchema,
  status: BuyRequestStatusSchema
})

export const MarketplaceBuyRequestsResponseSchema = looseObject({
  requests: array(BuyRequestSchema),
  pagination: PostgreSqlCountPaginationSchema
})

const HotboardProductSchema = looseObject({
  id: EntityIdSchema,
  name: NonemptyStringSchema
})

const HotboardSellerSchema = looseObject({
  username: string()
})

export const MarketplaceHotboardResponseSchema = looseObject({
  trustLevel: pipe(number(), integer(), minValue(1)),
  sellerTop: array(HotboardSellerSchema),
  viewTop: array(HotboardProductSchema),
  soldTop: array(HotboardProductSchema),
  categoryTrend: array(looseObject({})),
  hourlyTrend: array(looseObject({}))
})

export const SearchSuggestionsResponseSchema = looseObject({
  normalizedQuery: string(),
  suggestions: array(looseObject({
    value: NonemptyStringSchema,
    label: NonemptyStringSchema,
    type: NonemptyStringSchema,
    productId: optional(nullable(union([number(), string()])))
  })),
  source: NonemptyStringSchema
})

export const DiscoveryPreferenceResponseSchema = looseObject({
  personalizationEnabled: boolean()
})

export const DiscoveryEventResponseSchema = looseObject({
  accepted: optional(NonnegativeIntegerSchema),
  rejected: optional(NonnegativeIntegerSchema)
})

export const PublicStatsResponseSchema = looseObject({
  products: looseObject({}),
  orders: looseObject({}),
  stores: unknown()
})

export const UserDashboardResponseSchema = looseObject({
  overview: looseObject({}),
  merchant: looseObject({}),
  spendingDistribution: looseObject({}),
  incomeDistribution: looseObject({})
})

export const UserAttentionOrderSchema = looseObject({
  id: optional(unknown()),
  orderNo: optional(nullable(string())),
  productId: optional(unknown()),
  productName: optional(nullable(string())),
  amount: optional(unknown()),
  status: optional(nullable(string())),
  createdAt: optional(nullable(unknown())),
  fulfillmentDeadlineAt: optional(nullable(unknown()))
})

export const UserAttentionResponseSchema = looseObject({
  pendingPaymentCount: optional(unknown()),
  awaitingDeliveryCount: optional(unknown()),
  refundAttentionCount: optional(unknown()),
  unusedCouponCount: optional(unknown()),
  expiringCouponCount: optional(unknown()),
  pendingReportCount: optional(unknown()),
  nextFulfillmentDeadlineAt: optional(nullable(unknown())),
  recentOrders: optional(array(UserAttentionOrderSchema)),
  generatedAt: optional(unknown())
})

export type Pagination = InferOutput<typeof PaginationSchema>
export type Category = InferOutput<typeof CategorySchema>
export type Product = InferOutput<typeof ProductSchema>
export type ProductListResponse = InferOutput<typeof ProductListResponseSchema>
export type MerchantProfile = InferOutput<typeof MerchantProfileResponseSchema>
export type ProductComment = InferOutput<typeof CommentSchema>
export type ProductCommentReply = InferOutput<typeof CommentReplySchema>
export type ProductReport = InferOutput<typeof ProductReportSchema>
export type MarketplaceShop = InferOutput<typeof ShopSchema>
export type BuyRequest = InferOutput<typeof BuyRequestSchema>
