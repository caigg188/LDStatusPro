import { test, expect, product } from './fixtures'
test('search transports empty and nonempty response contexts without static hot guidance', async ({ page, scenario }) => {
  void scenario
  const events: Array<Record<string, unknown>> = []
  await page.route('**/api/shop/search/suggestions*', route => route.fulfill({json:{success:true,data:{normalizedQuery:'',suggestions:[],source:'fallback'}}}))
  await page.route('**/api/shop/discovery/events', route => {
    const batch = route.request().postDataJSON().events
    events.push(...batch)
    return route.fulfill({json:{success:true,data:{accepted:batch.length,rejected:0}}})
  })
  await page.route('**/api/shop/products?*', route => {
    const query = new URL(route.request().url()).searchParams.get('search')
    const empty = query !== 'available-fixture'
    return route.fulfill({json:{success:true,data:{
      products:empty?[]:[{...product,discovery_token:'d1.product.fixture'}],
      pagination:{total:empty?0:1,page:1,pageSize:20,totalPages:empty?0:1,hasMore:false},
      rankingContext:{surface:'search',version:'catalog-search-v2.1@fixture',fallback:false,requestId:'isolated-request',searchToken:empty?'s1.empty.fixture':'s1.available.fixture'}
    }}})
  })
  await page.goto('/search')
  await expect(page.getByRole('heading',{name:'热门搜索'})).toHaveCount(0)
  const input=page.getByRole('combobox')
  await input.fill('empty-fixture')
  await input.press('Enter')
  await expect(page.getByText('未找到相关物品',{exact:true})).toBeVisible()
  await expect.poll(()=>events.some(event=>event.type==='search_zero_result')).toBe(true)
  expect(events.filter(event=>event.type==='search_submit'||event.type==='search_zero_result').every(event=>event.searchToken==='s1.empty.fixture')).toBe(true)
  await input.fill('available-fixture')
  await input.press('Enter')
  await expect(page.getByText(product.name,{exact:true})).toBeVisible()
  await expect.poll(()=>events.some(event=>event.type==='search_submit'&&event.searchToken==='s1.available.fixture')).toBe(true)
  await page.getByText(product.name,{exact:true}).click()
  await expect(page).toHaveURL(/\/product\/7$/)
  await expect.poll(()=>events.some(event=>event.type==='click'&&event.discoveryToken==='d1.product.fixture')).toBe(true)
})
