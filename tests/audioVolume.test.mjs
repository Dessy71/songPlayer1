import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=ts.transpileModule(fs.readFileSync('src/lib/audioVolume.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const module=new vm.SourceTextModule(source);await module.link(()=>{throw new Error('Unexpected dependency');});await module.evaluate();
const {usesSystemVolume,applyAudioVolume}=module.namespace;
test('iPhone, iPad and desktop-mode iPad use system loudness controls',()=>{
 for(const device of [{userAgent:'iPhone',platform:'iPhone',maxTouchPoints:5},{userAgent:'iPad',platform:'iPad',maxTouchPoints:5},{userAgent:'Safari',platform:'MacIntel',maxTouchPoints:5}]) assert.equal(usesSystemVolume(device),true);
 for(const device of [{userAgent:'Safari',platform:'MacIntel',maxTouchPoints:0},{userAgent:'Android',platform:'Linux',maxTouchPoints:5},{userAgent:'Chrome',platform:'Win32',maxTouchPoints:0}]) assert.equal(usesSystemVolume(device),false);
});
test('native mute works even when iPhone ignores volume writes',()=>{
 const audio={muted:false,get volume(){return 1;},set volume(value){}};
 applyAudioVolume(audio,0.5,true);assert.equal(audio.muted,true);
 applyAudioVolume(audio,0.5,false);assert.equal(audio.muted,false);
 applyAudioVolume(audio,0,false);assert.equal(audio.muted,true);
});
test('desktop loudness clamps valid ranges and rejects NaN',()=>{
 const audio={muted:false,volume:1};
 applyAudioVolume(audio,0.4,false);assert.equal(audio.volume,0.4);
 applyAudioVolume(audio,2,false);assert.equal(audio.volume,1);
 applyAudioVolume(audio,-1,false);assert.equal(audio.volume,0);assert.equal(audio.muted,true);
 applyAudioVolume(audio,NaN,false);assert.equal(audio.volume,0.9);assert.equal(audio.muted,false);
});
