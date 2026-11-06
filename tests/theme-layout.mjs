// Optional: npm install --no-save playwright, then npx playwright install chromium
import { chromium as pw } from 'playwright';
import assert from 'node:assert/strict';

for(const [width,height] of [[320,568],[393,852],[1280,800]]){
 const browser=await pw.launch({headless:true});
 const page=await browser.newPage({viewport:{width,height},colorScheme:'dark'});
 await page.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:5173')?r.continue():r.abort());
 await page.goto('http://127.0.0.1:5173');
 await page.getByRole('button',{name:'Switch to light theme'}).click();
 assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
 assert.equal(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgb(255, 255, 255)');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.reload();await page.getByRole('button',{name:'Switch to dark theme'}).click();
 assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
 console.log(`PASS ${width}x${height}: visible theme toggle, light surface, persistence, dark restore, no horizontal overflow`);
 await browser.close();
}
