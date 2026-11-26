const frontendUrl = (process.env.CHOICE_FRONTEND_URL || 'http://127.0.0.1:5191').replace(/\/$/, '');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();
 let status='Accepted'; let pickupCalls=0; let completeCalls=0; let positions=0; let available=true; let twoRides=false;
 const ride=()=>({id:'r1',passengerId:'p1',driverId:'d1',plannerMode:'Choice',status,pickupLat:28.63,pickupLng:77.21,dropLat:28.55,dropLng:77.1,lockedFare:123,fare:999,passenger:{name:'Current passenger',phone:'123'},plannedStops:status==='Accepted'?[{rideId:'r1',type:'pickup',lat:28.63,lng:77.21,passengerName:'Current passenger'},{rideId:'r1',type:'dropoff',lat:28.55,lng:77.1,passengerName:'Current passenger'}]:[{rideId:'r1',type:'dropoff',lat:28.55,lng:77.1,passengerName:'Current passenger'}]});
 await page.addInitScript(()=>{localStorage.setItem('token','fixture');localStorage.setItem('user',JSON.stringify({id:'u1',role:'Driver',driver:{id:'d1'}}));});
 await page.route('**/api/**',async route=>{const path=new URL(route.request().url()).pathname;let body={};
 if(path==='/api/users/u1')body={id:'u1',name:'Demo driver',driver:{id:'d1',isAvailable:available,currentLocationLat:28.65,currentLocationLng:77.22}};
 if(path.endsWith('/all'))body={history:[]};
 if(path.endsWith('/stats'))body={stats:{todayTrips:0,todayEarnings:0,thisWeekEarnings:0,thisMonthEarnings:0,completedRides:0,cancelledRides:0,rating:0,reviewCount:0}};
 if(path.endsWith('/current'))body={rides:status==='Completed'?[]:[ride(),...(twoRides?[{...ride(),id:'r2',passenger:{name:'Later passenger',phone:'789'}}]:[]),{...ride(),id:'pending',status:'Requested',offerExpiresAt:new Date(Date.now()+30000).toISOString(),passenger:{name:'New passenger',phone:'456'}}],serverTime:new Date().toISOString()};
 if(path.endsWith('/pickup')){pickupCalls++;status='PickedUp';body={ride:ride()};}
 if(path.endsWith('/complete')){completeCalls++;status='Completed';body={ride:ride()};}
 if(path.endsWith('/availability'))available=route.request().postDataJSON().isAvailable;
 if(path.endsWith('/location'))positions++;
 await route.fulfill({json:body});});
 await page.goto(`${frontendUrl}/driver`);
 await page.getByRole('button',{name:'Picked up',exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Dropped off',exact:true}).count(),0);
 await page.getByText('Incoming Ride Request',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Picked up',exact:true}).click();
 await page.getByRole('button',{name:'Dropped off',exact:true}).waitFor();assert.equal(pickupCalls,1);
 await page.reload();await page.getByRole('button',{name:'Dropped off',exact:true}).waitFor();
 await page.getByRole('button',{name:'Online',exact:true}).click();
 await page.getByRole('checkbox',{name:'Simulate driving (demo)'}).check();
 await page.waitForTimeout(6500);assert.ok(positions>0,'Tracking continues while unavailable with an active ride');
 await page.getByRole('button',{name:'Dropped off',exact:true}).click();assert.equal(completeCalls,1);
 status='Accepted'; twoRides=true; await page.reload();
 const pickups=page.getByRole('button',{name:'Picked up',exact:true}); await pickups.last().waitFor();
 assert.equal(await pickups.count(),2); assert.equal(await pickups.first().isEnabled(),true); assert.equal(await pickups.last().isDisabled(),true,'Later stop stays disabled until it becomes the next canonical stop');
 status='Completed'; twoRides=false; available=true;
 await page.addInitScript(()=>{
  const state=window.__gps={watches:0,reads:[],clears:0,suspend:false,pending:[]};
  const fix=()=>({coords:{latitude:28.65,longitude:77.22},timestamp:Date.now()});
  Object.defineProperty(navigator,'geolocation',{configurable:true,value:{
   watchPosition(success){state.watches++;success(fix());return state.watches;},
   getCurrentPosition(success,error,options){state.reads.push(options);if(state.suspend)state.pending.push(()=>success(fix()));else success(fix());},
   clearWatch(){state.clears++;}
  }});
 });
 await page.clock.install(); await page.reload();
 await page.getByRole('button',{name:'Online',exact:true}).waitFor();
 const stationaryStart=positions;
 await page.clock.runFor(65000); await page.waitForTimeout(100);
 const gps=await page.evaluate(()=>window.__gps);
 assert.ok(gps.reads.length>=3,'A stationary watch must request fresh GPS fixes throughout 60s');
 assert.ok(gps.reads.every(options=>options.maximumAge===0),'Fresh fixes must bypass GPS cache');
 assert.ok(positions-stationaryStart>=3,'Stationary fresh fixes keep posting driver location');
 await page.evaluate(()=>{window.__gps.suspend=true});
 const suspendedStart=positions;
 await page.clock.runFor(20000); await page.waitForTimeout(100);
 assert.equal(positions,suspendedStart,'An unanswered GPS read cannot refresh an old coordinate');
 await page.getByRole('button',{name:'Online',exact:true}).click();
 await page.getByRole('button',{name:'Offline',exact:true}).waitFor();
 const readsAtCleanup=await page.evaluate(()=>window.__gps.reads.length);
 assert.ok(await page.evaluate(()=>window.__gps.clears>0),'Cleanup clears the GPS watch');
 await page.evaluate(()=>window.__gps.pending.forEach(finish=>finish()));
 await page.clock.runFor(65000); await page.waitForTimeout(100);
 assert.equal(await page.evaluate(()=>window.__gps.reads.length),readsAtCleanup,'Cleanup stops periodic fresh GPS reads');
 assert.equal(positions,suspendedStart,'Late GPS callbacks after cleanup do not post');
 console.log('PASS stationary fresh GPS polling, cache bypass, suspended-read safety and cleanup');
 console.log('PASS later passenger action disabled by canonical stop order');
 console.log('PASS driver insertion offer coexists, pickup-before-dropoff, PickedUp reload recovery, tracking while unavailable, completion');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
