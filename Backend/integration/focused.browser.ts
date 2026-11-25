/** Reproducible mocked-boundary UI regressions; run separately from browser.e2e.ts. */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createServer } from '../../Frontend/node_modules/vite/dist/node/index.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
process.chdir(path.join(root,'Frontend'));
const server=await createServer({root:path.join(root,'Frontend'),server:{host:'127.0.0.1',port:5191,strictPort:true}});
await server.listen();
try{
  for(const name of ['passenger-choice','driver-choice','bookings-choice']){
    await new Promise<void>((resolve,reject)=>{
      const child=spawn(process.execPath,[path.join(root,'Frontend/integration',`${name}.browser.cjs`)],{
        stdio:'inherit',env:{...process.env,CHOICE_FRONTEND_URL:'http://127.0.0.1:5191'},windowsHide:true,
      });
      child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(new Error(`${name} browser fixture exited ${code}`)));
    });
  }
}finally{await server.close();}
