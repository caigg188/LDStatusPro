// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { normalizeResourceId } from '@/utils/resourceId'
import { normalizeOrderConfirmDraft, shouldPreserveCheckoutDraft } from '@/stores/checkout'
import { resolveOrderSubjectTarget } from '@/utils/orderNavigation'
import { resolveConversationPath } from '@/services/shop/conversationService'
import { topServiceQuoteChanged } from '@/utils/topServiceOrder'
import { rememberDiscoveryToken, getDiscoveryTokenForProduct } from '@/services/shop/discoveryService'
import { safeParse } from 'valibot'
import { ProductSchema, CategorySchema } from '@/contracts/catalog'

const product='aaaaaaaa-1111-4111-8111-111111111111'
const claim='bbbbbbbb-2222-4222-8222-222222222222'
const session='cccccccc-3333-4333-8333-333333333333'
describe('opaque public resource references',()=>{
  it('dual reads UUIDv4 and historical IDs without partial numeric parsing',()=>{
    expect(normalizeResourceId(product)).toBe(product)
    expect(normalizeResourceId('42')).toBe(42)
    for(const value of ['42suffix','42.5','0','-1',product.replace('-4111-','-7111-')]) expect(normalizeResourceId(value)).toBe(0)
  })
  it('keeps UUID product/coupon drafts and return navigation intact',()=>{
    expect(normalizeOrderConfirmDraft({productId:product,couponClaimId:claim,quantity:2,updatedAt:Date.now()})).toMatchObject({productId:product,couponClaimId:claim,quantity:2})
    expect(shouldPreserveCheckoutDraft({name:'ProductDetail',params:{id:product}},product)).toBe(true)
    expect(shouldPreserveCheckoutDraft({name:'ProductDetail',params:{id:claim}},product)).toBe(false)
  })
  it('uses UUID references in order and conversation navigation',()=>{
    expect(resolveOrderSubjectTarget({productId:product})).toBe(`/product/${product}`)
    expect(resolveOrderSubjectTarget({orderType:'buy_request',requestId:product})).toBe(`/buy-request/${product}`)
    expect(resolveConversationPath({requestId:product,sessionId:session})).toBe(`/buy-request/${product}?session=${session}`)
  })
  it('keeps attribution by UUID instead of collapsing the cache to NaN',()=>{
    rememberDiscoveryToken({id:product,discoveryToken:'d2.signed-payload.signature'})
    expect(getDiscoveryTokenForProduct(product)).toBe('d2.signed-payload.signature')
    expect(getDiscoveryTokenForProduct(claim)).toBe('')
  })
  it('compares opaque product references without numeric coercion',()=>{
    const quote={productId:product,packageType:'global',durationDays:1,amount:10,categoryId:1}
    expect(topServiceQuoteChanged(quote,quote)).toBe(false)
    expect(topServiceQuoteChanged(quote,{...quote,productId:claim})).toBe(true)
  })
  it('accepts resource UUIDs while preserving the numeric category contract',()=>{
    expect(safeParse(ProductSchema,{id:product,name:'Product'}).success).toBe(true)
    expect(safeParse(CategorySchema,{id:product,name:'Category'}).success).toBe(false)
    expect(safeParse(CategorySchema,{id:1,name:'Category'}).success).toBe(true)
  })
})
