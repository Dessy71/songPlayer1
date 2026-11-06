// Optional: npm install --no-save --package-lock=false playwright
// npx playwright install chromium
// With the app running on port 5173: node tests/mobile-layout.mjs
import { chromium as playwright } from 'playwright';
import assert from 'node:assert/strict';
for(const [width,height,top,left,right,bottom] of [[393,852,59,0,0,34],[320,568,20,0,0,0],[852,393,0,59,59,21],[640,800,0,0,0,0],[768,1024,0,0,0,0],[1280,800,0,0,0,0]]) {
 const browser=await playwright.launch({headless:true,});
 const context=await browser.newContext({viewport:{width,height},isMobile:width<1000,hasTouch:width<1000,serviceWorkers:'block'});
 const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/rest/v1/**',route=>route.fulfill({status:200,contentType:'application/json',body:route.request().url().includes('platform_settings')?'null':'[]'}));
 await page.route('**/auth/v1/**',route=>route.fulfill({status:200,contentType:'application/json',body:'null'}));
 await page.route('**/fonts.googleapis.com/**',route=>route.abort());
 await page.route('**/js.paystack.co/**',route=>route.abort());
 await page.goto('http://localhost:5173/',{waitUntil:'domcontentloaded'});
 await page.evaluate(({top,left,right,bottom})=>{for(const [k,v] of Object.entries({top,left,right,bottom}))document.documentElement.style.setProperty(`--safe-${k}`,`${v}px`);},{top,left,right,bottom});
 const menu=page.getByRole('button',{name:'Open menu',exact:true});
 const search=page.getByPlaceholder('Search songs, Twi/English lyrics, artistes, campuses, sermons...');
 await search.waitFor();
 assert.equal(await page.locator('header').getByTitle('Gyidi Nwom Premium Pricing & Billing').count(),0);
 for(const locator of [search,...(width<1024?[menu]:[])]){
  const box=await locator.boundingBox();assert.ok(box.y>=top,`top overlap at ${width}: ${box.y}<${top}`);assert.ok(box.x>=left);assert.ok(box.x+box.width<=width-right+1);assert.ok(box.y+box.height<=height-bottom);
 }
 await search.fill('hymn');assert.equal(await search.inputValue(),'hymn');
 if(width<1024){await menu.click();const close=page.getByRole('button',{name:'Close sidebar menu',exact:true});await close.waitFor();const box=await close.boundingBox();assert.ok(box.y>=top);await close.click();}
 const sizes=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth,mainHeight:document.querySelector('main').clientHeight,mainOverflow:getComputedStyle(document.querySelector('main')).overflowY}));
 assert.ok(sizes.scroll<=sizes.width,JSON.stringify(sizes));assert.ok(sizes.mainHeight>100);assert.equal(sizes.mainOverflow,'auto');
 const scrolled=await page.evaluate(()=>{const main=document.querySelector('main');const fixture=document.createElement('div');fixture.style.height=`${innerHeight*2}px`;fixture.setAttribute('data-test-scroll-fixture','');main.appendChild(fixture);main.scrollTop=120;return main.scrollTop;});assert.ok(scrolled>0,'Main content must actually scroll');assert.deepEqual(errors,[]);
 console.log(`PASS ${width}x${height}, simulated safe insets ${top}/${right}/${bottom}/${left}: search editable, menu tappable, removed header icons absent, main scrollable, no horizontal overflow.`);
 await browser.close();
}
