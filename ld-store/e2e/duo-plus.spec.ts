import { test,expect,signIn,product } from './fixtures'
test('DUO+ purchase, payment reconciliation, progress and pause remain usable on small screens',async({page},info)=>{
 await signIn(page)
 const requests:Record<string,unknown>[]=[]
 let paid=false,paused=false,orderExists=false
 const campaign=()=>({id:'00000000-0000-4000-8000-000000000001',product_id:7,target:100,delivered:37,remaining:63,state:paused?'paused':'active',pause_reason:paused?'manual':null,extended:true,internal:false,product_name:'独立曝光推广物品',today_impressions:12,clicks:3,expected_at:'2026-10-16T12:00:00Z'})
 await page.route('**/api/shop/duo-plus/**',async route=>{
  const path=new URL(route.request().url()).pathname,method=route.request().method()
  const ok=(data:unknown)=>route.fulfill({json:{success:true,data}})
  if(path.endsWith('/options'))return ok({settings:{purchaseEnabled:true,deliveryEnabled:true},products:[{id:7,name:'独立曝光推广物品',reason:orderExists?'已有未完成 DUO+ 或待支付订单':''}],packages:[{id:1,name:'试运营曝光包',target:100,price:'10.00',expected_days:7}]})
  if(path.endsWith('/orders')&&method==='POST'){requests.push(route.request().postDataJSON());orderExists=true;return ok({orderNo:'LU123abcdef',paymentUrl:'https://payment.invalid/duo'})}
  if(path.endsWith('/orders'))return ok({orders:orderExists?[{orderNo:'LU123abcdef',productId:7,package:{name:'试运营曝光包',productName:'独立曝光推广物品'},amount:'10.00',status:paid?'paid':'pending',paymentUrl:paid?null:'https://payment.invalid/duo'}]:[],campaigns:paid?[campaign()]:[],updatedAt:new Date().toISOString()})
  if(path.endsWith('/refresh')){paid=true;return ok({status:'paid'})}
  if(path.endsWith('/pause')){paused=true;return ok({success:true})}
  if(path.endsWith('/resume')){paused=false;return ok({success:true})}
  if(path.includes('/campaigns/'))return ok({campaign:campaign(),series:[{day:'2026-10-17',impressions:37,clicks:3}],operations:[]})
  return route.abort()
 })
 if(info.project.name==='mobile')await page.setViewportSize({width:320,height:780})
 await page.goto('/seller/duo-plus')
 await expect(page.getByRole('heading',{name:'创建曝光推广'})).toBeVisible()
 await page.getByRole('combobox',{name:'推广物品',exact:true}).selectOption('7')
 await page.getByRole('radio',{name:'试运营曝光包，100 次有效曝光，10.00 LDC'}).check()
 const submit=page.getByRole('button',{name:'创建 LDC 支付订单'})
 await expect(submit).toBeDisabled();await page.getByLabel('我已阅读并接受以上规则').check();await submit.click()
 await expect(page.getByRole('link',{name:'继续支付'})).toHaveAttribute('href','https://payment.invalid/duo')
 expect(requests).toHaveLength(1);expect(requests[0]).toMatchObject({productId:7,packageId:1});expect(String(requests[0].requestKey)).toMatch(/^[a-f0-9-]{36}$/)
 await page.getByRole('button',{name:'核对支付'}).click()
 await expect(page.locator('.duo-campaign')).toContainText('已延长交付')
 await expect(page.locator('progress')).toHaveAttribute('value','37')
 await page.getByRole('button',{name:'每日明细'}).click();await expect(page.locator('.duo-detail')).toContainText('3 次去重点击')
 await page.getByRole('button',{name:'暂停',exact:true}).click();await expect(page.locator('.duo-campaign')).toContainText('已暂停')
 await page.getByRole('button',{name:'恢复并重新排期'}).click();await expect(page.locator('.duo-campaign')).toContainText('投放中')
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
 }
 await page.setViewportSize({width:1440,height:1000})
 await page.locator('.seller-workspace').evaluate(el=>el.scrollTop=0)
 await page.getByRole('heading',{name:'创建曝光推广'}).scrollIntoViewIfNeeded()
 await page.locator('.seller-workspace').evaluate(el=>el.scrollTop=0)
 await page.screenshot({path:info.outputPath('duo-progress-light-1440.png'),fullPage:true,animations:'disabled'})
 await page.setViewportSize({width:320,height:900})
 await expect.poll(()=>page.locator('#seller-navigation').evaluate(el=>el.getBoundingClientRect().right)).toBeLessThanOrEqual(0)
 await page.locator('.duo-campaign').scrollIntoViewIfNeeded()
 await page.screenshot({path:info.outputPath('duo-progress-light-320.png'),fullPage:true,animations:'disabled'})
 await page.evaluate(()=>document.documentElement.classList.add('dark'))
 await page.screenshot({path:info.outputPath('duo-progress-dark.png'),fullPage:true,animations:'disabled'})
})

test('promoted product shows an ad label and reports a foreground qualified exposure',async({page})=>{
 await signIn(page)
 const events:unknown[]=[]
 await page.route('**/api/shop/products?*',route=>route.fulfill({json:{success:true,data:{products:[{...product,duo_promotion:{kind:'paid',token:'signed-paid-fixture',label:'广告'}}],pagination:{total:1,page:1,pageSize:20,totalPages:1,hasMore:false}}}}))
 await page.route('**/api/shop/duo-plus/events',route=>{events.push(route.request().postDataJSON());return route.fulfill({json:{success:true,data:{accepted:1}}})})
 await page.goto('/')
 const card=page.locator('.product-card').first();await card.scrollIntoViewIfNeeded()
 await expect(card.getByText('广告',{exact:true})).toBeVisible()
 await expect.poll(()=>events.length).toBe(1)
 expect(events[0]).toEqual({events:[{token:'signed-paid-fixture',type:'impression'}]})
})

test('DUO+ closed storefront has a complete responsive empty state and keyboard-readable rules',async({page},info)=>{
 await signIn(page)
 let creates=0
 await page.route('**/api/shop/duo-plus/**',route=>{
  const path=new URL(route.request().url()).pathname
  if(route.request().method()==='POST'){creates++;return route.abort()}
  const data=path.endsWith('/options')?{settings:{purchaseEnabled:false},products:[],packages:[]}:{orders:[],campaigns:[],updatedAt:'2026-10-17T08:00:00Z'}
  return route.fulfill({json:{success:true,data}})
 })
 await page.goto('/seller/duo-plus')
 await expect(page.getByText('DUO+ 暂未开放购买',{exact:true})).toBeVisible()
 await expect(page.getByText('曝光套餐准备中',{exact:true})).toBeVisible()
 await expect(page.getByRole('button',{name:'创建 LDC 支付订单'})).toBeDisabled()
 await expect(page.getByLabel('我已阅读并接受以上规则')).toBeDisabled()
 await page.getByRole('button',{name:'阅读曝光与交付规则'}).focus()
 await page.keyboard.press('Enter')
 await expect(page.locator('.duo-rules')).toHaveAttribute('open','')
 await expect(page.locator('.duo-rules summary')).toBeFocused()
 await expect(page.getByText('已登录用户前台看见卡片至少 50%，持续 1 秒，才计有效曝光。')).toBeVisible()
 await page.keyboard.press('Enter')
 await expect(page.locator('.duo-rules')).not.toHaveAttribute('open','')
 for(const theme of ['light','dark']){
  await page.evaluate(theme=>document.documentElement.classList.toggle('dark',theme==='dark'),theme)
  for(const width of [320,390,768,1440]){
   await page.setViewportSize({width,height:1000})
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
   if(width<768)await expect.poll(()=>page.locator('#seller-navigation').evaluate(el=>el.getBoundingClientRect().right)).toBeLessThanOrEqual(0)
   await page.locator('.duo-rules summary').evaluate(el=>el.blur())
   await page.locator('.seller-workspace').evaluate(el=>el.scrollTop=0)
   await page.screenshot({path:info.outputPath(`duo-closed-${theme}-${width}.png`),fullPage:true,animations:'disabled'})
  }
 }
 expect(creates).toBe(0)
})


test('existing rights show platform delivery suspension without claiming active exposure',async({page})=>{
 await signIn(page)
 let resumed=false
 await page.route('**/api/shop/duo-plus/**',route=>{
  const path=new URL(route.request().url()).pathname
  const ok=(data:unknown)=>route.fulfill({json:{success:true,data}})
  if(path.endsWith('/resume')){resumed=true;return ok({success:true})}
  if(path.endsWith('/options'))return ok({settings:{purchaseEnabled:false,deliveryEnabled:false},products:[],packages:[]})
  return ok({orders:[],campaigns:[{id:'retained-rights',product_id:7,product_name:'已有推广物品',target:100,delivered:37,remaining:63,state:resumed?'active':'paused',pause_reason:resumed?null:'manual'}]})
 })
 await page.goto('/seller/duo-plus')
 await expect(page.getByText('平台暂未投放，已购剩余额度保留。活动恢复后仍需等待平台开放投放。')).toBeVisible()
 await page.getByRole('button',{name:'恢复并重新排期'}).click()
 await expect(page.getByRole('status').filter({hasText:'已恢复活动并重新排期。'})).toBeVisible()
 await expect(page.locator('.duo-campaign')).toContainText('等待平台恢复投放')
 await expect(page.locator('.duo-campaign')).not.toContainText('投放中')
 await expect(page.locator('progress')).toHaveAttribute('value','37')
})

test('a product removed from published options is cleared before another purchase',async({page})=>{
 await signIn(page)
 let listed=true,creates=0
 await page.route('**/api/shop/duo-plus/**',route=>{
  const path=new URL(route.request().url()).pathname
  if(route.request().method()==='POST'){creates++;return route.abort()}
  const data=path.endsWith('/options')?{settings:{purchaseEnabled:true,deliveryEnabled:false},products:listed?[{id:7,name:'已上架物品',reason:''}]:[],packages:[{id:1,name:'试运营曝光包',target:100,price:'10.00',expected_days:7}]}:{orders:[],campaigns:[]}
  return route.fulfill({json:{success:true,data}})
 })
 await page.goto('/seller/duo-plus')
 const select=page.getByRole('combobox',{name:'推广物品',exact:true})
 await expect(select).toContainText('选择已上架的物品')
 await select.selectOption('7')
 await page.getByRole('radio').check()
 await page.getByLabel('我已阅读并接受以上规则').check()
 await expect(page.getByRole('button',{name:'创建 LDC 支付订单'})).toBeEnabled()
 listed=false
 await page.getByRole('button',{name:'刷新进度'}).click()
 await expect(select).toHaveValue('')
 await expect(select).toContainText('暂无已上架的物品')
 await expect(page.getByLabel('我已阅读并接受以上规则')).not.toBeChecked()
 await expect(page.getByRole('button',{name:'创建 LDC 支付订单'})).toBeDisabled()
 expect(creates).toBe(0)
})
