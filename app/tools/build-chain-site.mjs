import {readFile,writeFile,mkdir,readdir,cp} from 'node:fs/promises';
import path from 'node:path';
import {build} from 'esbuild';
const source=path.resolve(import.meta.dirname,'..'),target=process.argv[2]?path.resolve(process.argv[2]):source;
if(target===source)throw Error('Choose a separate output directory, e.g. node tools/build-chain-site.mjs ../.runtime/meadow-build');
const assets={},types={'.html':'text/html;charset=utf-8','.css':'text/css;charset=utf-8','.mjs':'text/javascript;charset=utf-8','.js':'text/javascript;charset=utf-8','.json':'application/json;charset=utf-8','.svg':'image/svg+xml'};
async function walk(directory,prefix=''){
  for(const entry of await readdir(directory,{withFileTypes:true})){
    const relative=prefix+'/'+entry.name,full=path.join(directory,entry.name);
    if(entry.isDirectory()&&!['server','.openai'].includes(entry.name))await walk(full,relative);
    else if(types[path.extname(entry.name)])assets[relative]={type:types[path.extname(entry.name)],body:await readFile(full,'utf8')};
  }
}
await walk(path.join(source,'dist'));await writeFile(path.join(source,'backend/generated-assets.mjs'),'export const ASSETS='+JSON.stringify(assets)+';\n');
await mkdir(path.join(target,'dist/server'),{recursive:true});
await build({entryPoints:[path.join(source,'backend/worker.mjs')],outfile:path.join(target,'dist/server/index.js'),bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,legalComments:'eof',define:{'process.env.NODE_ENV':'"production"'},logLevel:'warning'});
await mkdir(path.join(target,'dist/.openai'),{recursive:true});
const manifest={project_id:'appgprj_6ae836178aac81919d53734cdfc3de35'};
await writeFile(path.join(target,'dist/.openai/hosting.json'),JSON.stringify(manifest,null,2)+'\n');
if(target!==source){
  await mkdir(path.join(target,'public'),{recursive:true});await cp(path.join(source,'dist'),path.join(target,'public'),{recursive:true,filter:p=>!p.includes('/dist/server')&&!p.includes('/dist/.openai')});
  await mkdir(path.join(target,'.openai'),{recursive:true});await writeFile(path.join(target,'.openai/hosting.json'),JSON.stringify(manifest,null,2)+'\n');
}
console.log(JSON.stringify({built:path.join(target,'dist/server/index.js'),assetCount:Object.keys(assets).length}));
