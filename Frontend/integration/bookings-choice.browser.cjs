const frontendUrl = (process.env.CHOICE_FRONTEND_URL || 'http://127.0.0.1:5191').replace(/\/$/, '');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();
 await page.addInitScript(()=>{localStorage.setItem('token','fixture');localStorage.setItem('user',JSON.stringify({id:'p1',role:'Passenger'}));});
 await page.route('**/api/**',route=>route.fulfill({json:{history:[{id:'r1',status:'PickedUp',fare:999,lockedFare:123,createdAt:new Date().toISOString(),pickupLat:28.63,pickupLng:77.21,dropLat:28.55,dropLng:77.1,route:{name:'CP to IGI'}}]}}));
 await page.goto(`${frontendUrl}/bookings`);await page.getByRole('button',{name:'Pending',exact:true}).click();
 await page.getByText('PickedUp',{exact:true}).waitFor({timeout:5000});assert.match(await page.locator('body').innerText(),/123/);assert.doesNotMatch(await page.locator('body').innerText(),/999/);
 console.log('PASS pending bookings include onboard ride and show locked fare');await browser.close();})().catch(e=>{console.error(e);process.exit(1)});
