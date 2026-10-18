import { FulfillmentInfoSchema } from './fulfillment'
import {
  array,
  boolean,
  integer,
  literal,
  looseObject,
  minLength,
  minValue,
  null_,
  nullable,
  number,
  optional,
  pipe,
  string,
  transform,
  union,
  unknown,
  type InferOutput
} from 'valibot'
import {
  PaginationSchema,
  PostgreSqlCountPaginationSchema,
  PostgreSqlCountSchema,
  ProductSchema
} from './catalog'

const PositiveIntegerSchema = pipe(number(), integer(), minValue(1))
const NonnegativeIntegerSchema = pipe(number(), integer(), minValue(0))
const NonemptyStringSchema = pipe(string(), minLength(1))
const EntityIdSchema = union([PositiveIntegerSchema, NonemptyStringSchema])

export const OrderStatusSchema = union([
  literal('pending'),
  pipe(literal('pending_payment'), transform(() => 'pending' as const)),
  literal('paying'),
  literal('paid'),
  literal('delivered'),
  literal('completed'),
  literal('cancelled'),
  literal('refunded'),
  literal('refund_pending'),
  literal('external_dispute'),
  literal('expired'),
  literal('uploaded'),
  literal('failed')
])

export const BuyOrderStatusSchema = union([
  literal('pending'),
  literal('paid'),
  literal('completed'),
  literal('cancelled'),
  literal('expired')
])

export const RefundStatusSchema = union([
  literal('requested'),
  literal('negotiating'),
  literal('processing'),
  literal('failed'),
  literal('unknown'),
  literal('refunded'),
  literal('rejected'),
  literal('external_dispute')
])

export const ProductInventoryResponseSchema = looseObject({
  products: array(ProductSchema),
  pagination: optional(PaginationSchema)
})

export const ProductImageLookupResponseSchema = looseObject({
  products: array(looseObject({
    id: EntityIdSchema,
    imageUrl: optional(nullable(string()))
  })),
  pagination: optional(looseObject({ totalPages: optional(NonnegativeIntegerSchema) }))
})

export const ProductEditorDetailResponseSchema = looseObject({
  product: ProductSchema
})

export const ProductSubmissionStatusResponseSchema = looseObject({
  exists: boolean(),
  submissionToken: NonemptyStringSchema,
  product: nullable(ProductSchema)
})

export const ProductMutationResponseSchema = looseObject({
  product: optional(ProductSchema),
  productId: optional(EntityIdSchema),
  submissionToken: optional(string()),
  status: optional(string()),
  message: optional(string())
})

export const CdkSchema = looseObject({
  id: EntityIdSchema,
  status: union([
    literal('available'),
    literal('locked'),
    literal('sold'),
    literal('expired'),
    literal('disabled')
  ])
})

export const CdkListResponseSchema = looseObject({
  cdks: array(CdkSchema),
  stats: looseObject({}),
  total: optional(NonnegativeIntegerSchema),
  pagination: optional(PaginationSchema)
})

export const CommerceActionResponseSchema = union([
  null_(),
  looseObject({
    message: optional(string()),
    status: optional(string())
  })
])

export const OrderActionsSchema = looseObject({
  canDeliver: boolean(), canConfirm: boolean(),
  deliveryDisabledReason: nullable(string()), confirmDisabledReason: nullable(string())
})
export const OrderPresentationFields = {
  displayStatus: optional(union([OrderStatusSchema, literal('refund_failed')])),
  refundStatus: optional(nullable(RefundStatusSchema)),
  orderActions: optional(OrderActionsSchema)
}
export const OrderSchema = looseObject({
  ...OrderPresentationFields,
  fulfillment: optional(FulfillmentInfoSchema),
  orderNo: NonemptyStringSchema,
  status: OrderStatusSchema
})

export const OrderListResponseSchema = looseObject({
  orders: array(OrderSchema),
  pagination: PaginationSchema
})

export const OrderDetailResponseSchema = looseObject({
  order: OrderSchema,
  logs: optional(array(looseObject({})))
})

export const OrderCreatedResponseSchema = looseObject({
  paymentState: optional(string()),
  paymentResolutionDeadline: optional(nullable(string())),
  retryAfterSeconds: optional(nullable(number())),
  orderNo: NonemptyStringSchema,
  orderId: EntityIdSchema,
  paymentUrl: optional(nullable(string())),
  expireAt: optional(unknown())
})

export const OrderSubmissionResponseSchema = looseObject({
  exists: boolean(),
  order: nullable(OrderCreatedResponseSchema)
})

export const OrderPaymentResponseSchema = looseObject({
  paymentUrl: optional(nullable(string())),
  status: optional(OrderStatusSchema),
  message: optional(string())
})

export const BuyOrderSchema = looseObject({
  orderNo: NonemptyStringSchema,
  status: BuyOrderStatusSchema
})

export const BuyOrderListResponseSchema = looseObject({
  orders: array(BuyOrderSchema),
  pagination: PaginationSchema
})

export const BuyOrderDetailResponseSchema = looseObject({
  order: BuyOrderSchema
})

export const BuyOrderPaymentResponseSchema = looseObject({
  paymentUrl: optional(nullable(string())),
  status: optional(BuyOrderStatusSchema),
  message: optional(string())
})

const RefundResponseFields = {
  decisionDeadlineAt: optional(nullable(string())),
  responsePolicyVersion: optional(nullable(string())),
  responsePolicySource: optional(nullable(string())),
  executionTrigger: optional(nullable(string())),
  overdue: optional(boolean()),
  dueSoon: optional(boolean()),
  attentionRequired: optional(boolean()),
  allowedActions: optional(looseObject({ approve: boolean(), reject: boolean(), contact: boolean() }))
}

export const RefundSchema = looseObject({
  ...RefundResponseFields,
  id: optional(EntityIdSchema),
  orderNo: NonemptyStringSchema,
  status: RefundStatusSchema,
  refundAmount: union([number(), string()]),
  events: array(looseObject({}))
})

export const OrderRefundResponseSchema = looseObject({
  ...OrderPresentationFields,
  serverNow: optional(string()),
  responsePolicyEnabled: optional(boolean()),
  fulfillment: optional(FulfillmentInfoSchema),
  role: union([literal('buyer'), literal('seller')]),
  eligibility: looseObject({
    canApply: boolean(),
    code: nullable(string()),
    message: string()
  }),
  refund: nullable(RefundSchema),
  disputeGuideUrl: string()
})

export const SellerRefundListResponseSchema = looseObject({
  serverNow: optional(string()),
  refunds: array(looseObject({
    ...RefundResponseFields,
    id: optional(EntityIdSchema),
    orderNo: NonemptyStringSchema,
    status: RefundStatusSchema,
    refundAmount: union([number(), string()])
  })),
  summary: looseObject({}),
  pagination: PaginationSchema
})

export const CouponCampaignSchema = looseObject({
  id: EntityIdSchema,
  status: optional(string()),
  state: optional(string())
})

export const CouponClaimSchema = looseObject({
  id: EntityIdSchema,
  status: NonemptyStringSchema
})

export const PublicCouponResponseSchema = CouponCampaignSchema

export const CouponClaimResponseSchema = looseObject({
  claim: CouponClaimSchema,
  campaign: CouponCampaignSchema,
  alreadyClaimed: boolean()
})

export const CouponListResponseSchema = looseObject({
  items: array(looseObject({})),
  pagination: PaginationSchema
})

export const OrderQuoteResponseSchema = looseObject({
  productId: EntityIdSchema,
  quantity: PositiveIntegerSchema,
  payableAmount: number(),
  coupons: array(looseObject({}))
})

export const MerchantConfigSchema = looseObject({
  configured: boolean(),
  isActive: boolean(),
  isVerified: boolean(),
  verifiedAt: optional(nullable(unknown())),
  ldcPid: optional(nullable(string())),
  stats: optional(looseObject({}))
})

export const MerchantConfigMutationSchema = looseObject({
  message: optional(string()),
  data: optional(looseObject({}))
})

export const MerchantEnforcementResponseSchema = looseObject({
  enforcement: looseObject({}),
  history: array(looseObject({}))
})

export const MerchantDashboardResponseSchema = looseObject({
  period: looseObject({}),
  kpis: looseObject({}),
  lifetime: looseObject({}),
  trend: array(looseObject({})),
  tasks: array(looseObject({}))
})

export const ShopSchema = looseObject({
  id: EntityIdSchema,
  name: NonemptyStringSchema,
  status: optional(string())
})

export const ShopDetailResponseSchema = ShopSchema

export const MyShopResponseSchema = nullable(ShopSchema)

export const ShopMutationResponseSchema = looseObject({
  shop: ShopSchema,
  message: optional(string())
})

export const BuyRequestStatusSchema = union([
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

export const BuyRequestListResponseSchema = looseObject({
  requests: array(BuyRequestSchema),
  pagination: PostgreSqlCountPaginationSchema
})

export const BuyRequestDetailResponseSchema = looseObject({
  request: BuyRequestSchema,
  viewerRole: optional(union([literal('requester'), literal('provider'), literal('guest')]))
})

export const BuySessionSchema = looseObject({
  id: EntityIdSchema,
  status: NonemptyStringSchema
})

export const BuySessionDetailResponseSchema = looseObject({
  session: BuySessionSchema,
  request: optional(BuyRequestSchema),
  order: optional(nullable(BuyOrderSchema))
})

export const BuyRequestMutationResponseSchema = looseObject({
  request: optional(BuyRequestSchema),
  status: optional(BuyRequestStatusSchema),
  message: optional(string())
})

export const BuySessionMutationResponseSchema = looseObject({
  session: optional(BuySessionSchema),
  order: optional(BuyOrderSchema),
  orderNo: optional(string()),
  paymentUrl: optional(nullable(string())),
  status: optional(string()),
  message: optional(string())
})

export const BuyMessagesResponseSchema = looseObject({
  messages: array(looseObject({ id: EntityIdSchema })),
  pagination: looseObject({}),
  session: optional(BuySessionSchema)
})

export const BuyMessageCreatedResponseSchema = looseObject({
  message: looseObject({ id: EntityIdSchema })
})

export const SystemMessagesResponseSchema = looseObject({
  messages: array(looseObject({ id: EntityIdSchema })),
  pagination: looseObject({
    total: PostgreSqlCountSchema,
    page: PositiveIntegerSchema,
    pageSize: PositiveIntegerSchema,
    totalPages: NonnegativeIntegerSchema
  }),
  summary: looseObject({ totalUnread: NonnegativeIntegerSchema })
})

export const NotificationSummaryResponseSchema = looseObject({})

export const ConversationListResponseSchema = looseObject({
  sessions: optional(array(BuySessionSchema)),
  conversations: optional(array(BuySessionSchema)),
  pagination: PaginationSchema,
  summary: optional(looseObject({}))
})

export const AnnouncementResponseSchema = looseObject({
  items: array(looseObject({ id: EntityIdSchema })),
  timestamp: number()
})

export const TopServiceOrderStatusSchema = union([
  literal('pending'),
  literal('active'),
  literal('suspended'),
  literal('expired'),
  literal('cancelled')
])

export const TopServiceOptionsResponseSchema = looseObject({
  products: array(looseObject({ id: EntityIdSchema, name: NonemptyStringSchema })),
  packages: array(looseObject({ type: NonemptyStringSchema }))
})

export const TopServiceOrderSchema = looseObject({
  orderNo: NonemptyStringSchema,
  status: TopServiceOrderStatusSchema
})

export const TopServiceOrdersResponseSchema = looseObject({
  orders: array(TopServiceOrderSchema),
  pagination: optional(looseObject({
    total: optional(NonnegativeIntegerSchema),
    page: optional(PositiveIntegerSchema),
    pageSize: optional(PositiveIntegerSchema),
    totalPages: optional(NonnegativeIntegerSchema)
  }))
})

export const TopServiceBoardResponseSchema = looseObject({})

export const TopServiceMutationResponseSchema = looseObject({
  order: optional(TopServiceOrderSchema),
  orderNo: optional(string()),
  status: optional(TopServiceOrderStatusSchema),
  paymentUrl: optional(nullable(string())),
  message: optional(string())
})

export const ExternalProductLinkResponseSchema = looseObject({
  paymentLink: NonemptyStringSchema
})

export type ProductEditorProductType = 'normal' | 'cdk' | 'link'
export type PurchaseLimitType = 'none' | 'per_order' | 'per_user'

export interface ProductEditorFormState {
  name: string
  description: string
  price: string
  discount: string | number
  categoryId: string | number | null
  imageUrl: string
  productType: ProductEditorProductType
  stock: string | number
  purchaseTrustLevel: number
  purchaseLimitType: PurchaseLimitType
  maxPurchaseQuantity: string | number
  purchaseLimitPeriodDays: string | number
  cdkCodes: string
  sharedCdkEnabled: boolean
  sharedCdkCode: string
  isTestMode: boolean
}

export interface ProductCreatePayload {
  name: string
  description: string
  price: number
  categoryId: number
  imageUrl: string
  productType: ProductEditorProductType
  discount: number
  purchaseTrustLevel: number
  purchaseLimitType: PurchaseLimitType
  maxPurchaseQuantity: number
  purchaseLimitPeriodDays: number
  stock?: number
  cdkCodes?: string
  sharedCdkEnabled?: boolean
  sharedCdkCode?: string
  isTestMode?: boolean
  submissionToken?: string
}

export type ProductUpdatePayload = Omit<ProductCreatePayload, 'productType' | 'submissionToken'> & {
  stock?: number
  sharedCdkEnabled?: boolean
  sharedCdkCode?: string
  isTestMode?: boolean
}

export type Order = InferOutput<typeof OrderSchema>
export type BuyOrder = InferOutput<typeof BuyOrderSchema>
export type Refund = InferOutput<typeof RefundSchema>
export type CouponCampaign = InferOutput<typeof CouponCampaignSchema>
export type MerchantConfig = InferOutput<typeof MerchantConfigSchema>
