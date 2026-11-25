/** Real Express + Socket.IO + PostgreSQL + Chrome smoke; only OSRM is local.
 * Requires CHOICE_TEST_DATABASE_URL (private local chalo_choice_* database),
 * PLAYWRIGHT_MODULE_PATH (installed Playwright package), and Chrome.
 * Never point this fixture at a live database; it resets the guarded test DB.
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const connection=process.env.CHOICE_TEST_DATABASE_URL;
if(!connection)throw new Error('CHOICE_TEST_DATABASE_URL is required');
const parsed=new URL(connection);
if(!['localhost','127.0.0.1'].includes(parsed.hostname)||!parsed.pathname.startsWith('/chalo_choice_'))throw new Error('Only an owned local chalo_choice_ fixture DB is allowed');
process.env.DATABASE_URL=connection;
process.env.ALLOW_TEST_LOGIN='true';
process.env.JWT_SECRET='local-browser-fixture-only';
process.env.DISABLE_MATCHING_LOOP='true';
process.env.CORS_ORIGIN='http://127.0.0.1:5193';
process.env.VITE_API_URL='http://127.0.0.1:8193';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const artifacts=path.resolve(process.env.CHOICE_BROWSER_ARTIFACTS||path.join(root,'../ChaloAuto-choice-verification-20261125'));
await mkdir(artifacts,{recursive:true});
const point=(x:number):[number,number]=>[28.6304-x*.000742,77.2177-x*.001177];
const metres=(a:number[],b:number[])=>Math.hypot(a[0]!-b[0]!,a[1]!-b[1]!)*100000;
let roadCalls=0;
const road=http.createServer((req,res)=>{
  roadCalls++;
  const url=new URL(req.url!,'http://localhost');
  const points=url.pathname.split('/').at(-1)!.split(';').map(s=>s.split(',').map(Number));
  const locations=points.map(p=>({location:p}));
  res.setHeader('Content-Type','application/json');
  if(url.pathname.startsWith('/table/'))res.end(JSON.stringify({code:'Ok',sources:locations,destinations:locations,distances:points.map(a=>points.map(b=>metres(a,b))),durations:points.map(a=>points.map(b=>metres(a,b)/5))}));
  else res.end(JSON.stringify({code:'Ok',waypoints:locations,routes:[{distance:metres(points[0]!,points.at(-1)!),duration:metres(points[0]!,points.at(-1)!)/5,geometry:{type:'LineString',coordinates:points}}]}));
});
await new Promise<void>(resolve=>road.listen(0,'127.0.0.1',resolve));
process.env.OSRM_BASE_URL=`http://127.0.0.1:${(road.address() as {port:number}).port}`;
const {prisma:db}=await import('../src/lib/prisma.ts');
const {signLocalToken}=await import('../src/lib/tokens.ts');
const {default:app}=await import('../src/app.ts');
const {initSocket}=await import('../src/lib/socket.ts');
process.chdir(path.join(root,'Frontend'));
const {createServer}=await import('../../Frontend/node_modules/vite/dist/node/index.js');
const api=http.createServer(app);const io=initSocket(api);
await new Promise<void>(resolve=>api.listen(8193,'127.0.0.1',resolve));
const vite=await createServer({root:path.join(root,'Frontend'),server:{host:'127.0.0.1',port:5193,strictPort:true}});
await vite.listen();
const browser=await chromium.launch({channel:'chrome',headless:true});
const errors:string[]=[];
try{
  await db.$executeRawUnsafe('TRUNCATE "ChoiceOffer", "Ride", "Vehicle", "Driver", "User", "RoutePoint", "Route" CASCADE');
  const route=await db.route.create({data:{name:'Connaught Place to IGI Airport',startLat:point(0)[0],startLng:point(0)[1],endLat:point(100)[0],endLng:point(100)[1],roadGeometry:[point(0),point(100)]}});
  const passenger=await db.user.create({data:{phone:'browser-passenger',name:'Browser Passenger',role:'Passenger'}});
  const drivers=[];
  for(let i=0;i<4;i++){
    const user=await db.user.create({data:{phone:`browser-driver-${i}`,name:`Browser Driver ${i}`,role:'Driver'}});
    const driver=await db.driver.create({data:{userId:user.id,licenseNumber:`BROWSER-${i}`,capacity:4,isAvailable:true,routeId:route.id,currentLocationLat:point(i)[0],currentLocationLng:point(i)[1],lastLocationAt:new Date()}});
    drivers.push({...user,driver});
  }
  const existingPassenger=await db.user.create({data:{phone:'browser-existing-passenger',name:'Existing Passenger',role:'Passenger'}});
  const existing=await db.ride.create({data:{passengerId:existingPassenger.id,driverId:drivers[0]!.driver.id,routeId:route.id,plannerMode:'Choice',status:'PickedUp',pickupLat:point(0)[0],pickupLng:point(0)[1],dropLat:point(100)[0],dropLng:point(100)[1],lockedFare:250,fare:250}});
  await db.driver.update({where:{id:drivers[0]!.driver.id},data:{remainingStops:[{rideId:existing.id,type:'dropoff',point:point(100)}]}});
  const call=(userId:string,endpoint:string,body:unknown)=>fetch(`http://127.0.0.1:8193/api/rides/${endpoint}`,{method:'POST',headers:{Authorization:`Bearer ${signLocalToken(userId)}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await call(passenger.id,'pickup',{rideId:existing.id})).status,403);
  assert.equal((await call(drivers[0]!.id,'options',{})).status,403);
  assert.equal((await call(passenger.id,'options',{pickupLat:'bad',pickupLng:77,dropLat:28,dropLng:77})).status,400);
  async function pageFor(user:any){
    const context=await browser.newContext();
    await context.addInitScript(({user,token}:any)=>{localStorage.setItem('user',JSON.stringify(user));localStorage.setItem('token',token);},{user,token:signLocalToken(user.id)});
    const page=await context.newPage();page.on('pageerror',(e:Error)=>errors.push(e.message));return page;
  }
  const p=await pageFor(passenger);
  console.log('Browser fixture: opening passenger screen');
  await p.goto('http://127.0.0.1:5193/find-rides');
  await p.getByText('Enter coordinates manually').click();
  for(const [placeholder,value] of [['Pickup lat',point(5)[0]],['Pickup lng',point(5)[1]],['Drop lat',point(60)[0]],['Drop lng',point(60)[1]]] as const)await p.getByPlaceholder(placeholder,{exact:true}).fill(String(value));
  const optionsResponse=p.waitForResponse((r:any)=>r.url().endsWith('/rides/options')&&r.status()===200);
  await p.getByRole('button',{name:'Find Auto',exact:true}).click();
  const listing=await (await optionsResponse).json();
  console.log('Browser fixture: API returned options',listing.options.length);
  assert.equal(listing.options.length,4);const selected=listing.options[1];
  assert.ok(listing.options.some((o:any)=>o.onboard===1),'Occupied auto appears beside empty autos');
  await p.getByRole('button',{name:`Choose ${selected.driver.name}`,exact:true}).waitFor({timeout:20000});
  assert.equal(await p.getByRole('button',{name:/^Choose Browser Driver/}).count(),4);
  assert.equal(await p.getByRole('link',{name:/OpenStreetMap/}).count(),1);
  const selectedUser=drivers.find(d=>d.driver.id===selected.driver.id)!;
  const d=await pageFor(selectedUser);await d.goto('http://127.0.0.1:5193/driver');
  console.log('Browser fixture: opening selected driver screen');
  await d.getByText('No incoming requests',{exact:true}).waitFor();
  await p.getByRole('button',{name:`Choose ${selected.driver.name}`,exact:true}).click();
  await d.getByRole('button',{name:'Accept',exact:true}).waitFor({timeout:10000});
  await p.getByText(/Response window:/).waitFor();
  await d.getByRole('button',{name:'Accept',exact:true}).click();
  console.log('Browser fixture: accepting selected request');
  await p.getByRole('heading',{name:'Driver accepted',exact:true}).waitFor({timeout:15000});
  await d.getByRole('button',{name:'Picked up',exact:true}).waitFor();
  await d.getByRole('button',{name:'Picked up',exact:true}).click();
  console.log('Browser fixture: recording pickup');
  await p.getByRole('heading',{name:'On board',exact:true}).waitFor();
  assert.equal(await p.getByRole('button',{name:'Cancel ride',exact:true}).count(),0);
  await p.reload();await p.getByRole('heading',{name:'On board',exact:true}).waitFor();
  // Exercise the connect recovery handler separately from a full page reload.
  await p.evaluate(async()=>{const {socket}=await import('/src/lib/socket.ts');socket.disconnect();});
  const reconnect=p.waitForResponse((r:any)=>r.url().endsWith(`/passenger/${passenger.id}/current`)&&r.status()===200);
  await p.evaluate(async()=>{const {socket}=await import('/src/lib/socket.ts');socket.connect();});
  assert.equal((await (await reconnect).json()).currentRides[0].status,'PickedUp');
  await p.getByRole('heading',{name:'On board',exact:true}).waitFor();
  const onboard=await db.ride.findFirstOrThrow({where:{passengerId:passenger.id,status:'PickedUp'}});
  assert.equal(onboard.driverId,selected.driver.id);assert.equal(onboard.lockedFare,selected.fare);
  await p.screenshot({path:path.join(artifacts,'passenger-onboard.png'),fullPage:true});
  await d.reload();await d.getByRole('button',{name:'Dropped off',exact:true}).first().waitFor();
  await d.getByRole('button',{name:'Online',exact:true}).click();
  await d.getByRole('button',{name:'Offline',exact:true}).waitFor();
  const completedResponse=d.waitForResponse((r:any)=>r.url().endsWith('/rides/complete'));
  await d.getByRole('button',{name:'Dropped off',exact:true}).and(d.locator('button:enabled')).click();
  const completed=await completedResponse;
  assert.equal(completed.status(),200,JSON.stringify(await completed.json()));
  await p.getByRole('heading',{name:'On board',exact:true}).waitFor({state:'hidden',timeout:10000});
  const done=await db.ride.findUniqueOrThrow({where:{id:onboard.id}});
  assert.equal(done.status,'Completed');assert.equal(done.fare,selected.fare);
  const rated=await call(passenger.id,'rate',{rideId:done.id,rating:5});assert.equal(rated.status,200);
  const history=await fetch(`http://127.0.0.1:8193/api/rides/passenger/${passenger.id}/history`,{headers:{Authorization:`Bearer ${signLocalToken(passenger.id)}`}});
  const historyBody=await history.json();assert.equal(historyBody.history[0].fare,selected.fare);assert.equal(historyBody.history[0].rating,5);
  const stats=await fetch(`http://127.0.0.1:8193/api/rides/driver/${selected.driver.id}/stats`,{headers:{Authorization:`Bearer ${signLocalToken(selectedUser.id)}`}});
  const statsBody=await stats.json();assert.equal(statsBody.stats.todayEarnings,selected.fare);assert.equal(statsBody.stats.completedRides,1);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({result:'PASS',flow:'four real options -> non-top choice -> live driver offer -> accept -> pickup -> reload both -> unavailable ongoing dropoff -> locked-fare completion',roadRequests:roadCalls,artifacts}));
}catch(error){
  for(const page of browser.contexts().flatMap((c:any)=>c.pages())){console.error('Fixture page',page.url(),await page.locator('body').innerText());await page.screenshot({path:path.join(artifacts,`failure-${Date.now()}.png`),fullPage:true});}
  throw error;
}finally{
  await browser.close();await vite.close();await new Promise<void>(resolve=>io.close(()=>resolve()));api.close();road.close();await db.$disconnect();
}
