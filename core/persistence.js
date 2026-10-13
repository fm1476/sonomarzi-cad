/* CAD persistence boundary, phase 1. Synchronous local demo adapter only.
 * Supabase integration must be asynchronous and use server-side transactions;
 * do not replace this adapter with network calls inside the render cycle.
 */
(()=>{'use strict';
 const adapters={
  local:{
   read(key){const value=localStorage.getItem(key);return value===null?null:JSON.parse(value)},
   write(key,value){localStorage.setItem(key,JSON.stringify(value));},
   remove(key){localStorage.removeItem(key)}
  }
 };
 Object.freeze(adapters.local);
 window.CadPersistence=Object.freeze({
  mode:'local',
  read:(key)=>adapters.local.read(key),
  write:(key,value)=>adapters.local.write(key,value),
  remove:(key)=>adapters.local.remove(key)
 });
})();
