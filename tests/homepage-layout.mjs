// Optional: npm install --no-save --package-lock=false playwright
// npx playwright install chromium
// Run the app on port 5173, then: node tests/homepage-layout.mjs
// Chromium emulates iPhone layout/UA; this does not replace real Safari testing.
import { chromium as playwright } from 'playwright';
import assert from 'node:assert/strict';
const songs=Array.from({length:6},(_,i)=>({id:`song-${i}`,slug:`song-${i}`,title:`Test hymn ${i+1}`,artist:'SCG Choir',category:'Songs',choir_group:'SCG',storage_path:'example.mp3',stream_url:'https://example.com/example.mp3',cover_theme:'amber',duration_seconds:180,file_size_bytes:500,plays_count:6-i,likes_count:1,approval_status:'approved',is_premiere:false,submitted_at:'2026-01-01T00:00:00Z',created_at:'2026-01-01T00:00:00Z'}));
for(const [width,height,iphone] of [[393,852,true],[375,667,true],[1280,800,false]]){
 const browser=await playwright.launch({headless:true,});
 const context=await browser.newContext({viewport:{width,height},isMobile:iphone,hasTouch:iphone,serviceWorkers:'block',...(iphone?{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'}:{})});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({iphone})=>{
  window.__testAudios=[];const NativeAudio=window.Audio;window.Audio=class extends NativeAudio{constructor(){super();window.__testAudios.push(this);}};
  HTMLMediaElement.prototype.play=function(){window.__playingAudio=this;this.dispatchEvent(new Event('play'));return Promise.resolve();};HTMLMediaElement.prototype.pause=function(){};
  if(iphone)Object.defineProperty(HTMLMediaElement.prototype,'volume',{get(){return 1},set() {}});
 },{iphone});
 await page.route('**/rest/v1/**',route=>{const table=new URL(route.request().url()).pathname.split('/').pop();return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(table==='songs'?songs:table==='platform_settings'?null:[])});});
 await page.route('**/fonts.googleapis.com/**',route=>route.abort());await page.route('**/js.paystack.co/**',route=>route.abort());await page.route('https://example.com/**',route=>route.abort());
 await page.clock.install();
 await page.goto('http://localhost:5173/',{waitUntil:'domcontentloaded'});
 if(iphone)await page.evaluate(()=>{document.documentElement.style.setProperty('--safe-top','59px');document.documentElement.style.setProperty('--safe-bottom','34px');});
 const card=page.getByTestId('spotlight-card');await card.waitFor();
 const firstPlay=page.getByTestId('home-listen-now').getByRole('button',{name:'Play Test hymn 1',exact:true});await firstPlay.waitFor();
 const box=await firstPlay.boundingBox();assert.ok(box.y+box.height<height-34,`Song not visible without scroll: ${JSON.stringify(box)}`);
 assert.equal(await page.locator('main').evaluate(el=>el.scrollTop),0);
 const second=await page.getByTestId('home-listen-now').getByRole('button',{name:'Play Test hymn 2',exact:true}).boundingBox();assert.ok(second.y+second.height<height-34,'Second song play button must be above fold');
 const firstHeight=(await card.boundingBox()).height;assert.equal(firstHeight,96);
 await page.getByRole('button',{name:'Next spotlight',exact:true}).click();assert.equal((await card.boundingBox()).height,firstHeight);assert.match(await card.textContent(),/Bible Verse/);
 await page.getByRole('button',{name:'Next spotlight',exact:true}).click();assert.equal((await card.boundingBox()).height,firstHeight);assert.match(await card.textContent(),/Coming soon/);
 await page.clock.fastForward(6100);assert.match(await card.textContent(),/Coming soon/,'Manual navigation pauses rotation');
 await page.getByRole('button',{name:'Play spotlight rotation'}).click();await page.mouse.move(0,0);await page.clock.fastForward(6100);assert.match(await card.textContent(),/Digital Sanctuary/,'Explicit play resumes rotation');
 await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('button',{name:'Play spotlight rotation'}).waitFor();await page.clock.fastForward(6100);assert.match(await card.textContent(),/Digital Sanctuary/,'Reduced motion disables automatic rotation');
 await firstPlay.click();
 if(iphone){await page.getByRole('button',{name:'iPhone volume instructions'}).click();assert.match(await page.getByRole('status').textContent(),/side volume buttons/);assert.equal(await page.getByRole('slider',{name:'Playback volume',exact:true}).count(),0);}
 else{assert.equal(await page.getByRole('slider',{name:'Playback volume',exact:true}).count(),1);}
 await page.getByTitle('Mute',{exact:true}).click();assert.equal(await page.evaluate(()=>window.__playingAudio.muted),true);
 await page.getByTitle('Unmute',{exact:true}).click();assert.equal(await page.evaluate(()=>window.__playingAudio.muted),false);
 assert.deepEqual(errors,[]);
 console.log(`PASS ${width}x${height}: first song visible at y=${box.y}, constant 96px slides, play works, ${iphone?'iPhone device-volume instructions':'desktop slider'}, native mute/unmute.`);
 await browser.close();
}
