// Scope recovery to the verified account/workspace; never reuse another login's drafts.
function scopedKey(key:string){return `syncflow-editor:${document.querySelector<HTMLElement>('[data-editor-scope]')?.dataset.editorScope||'uninitialized'}:${key}`;}
// Tab-local recovery only. These are unsent editor backups, never confirmed facts.
export function readEditorBackup(key:string):Record<string,string>|null {
 try {const raw=sessionStorage.getItem(scopedKey(key));if(!raw)return null;const value=JSON.parse(raw);return value&&typeof value==='object'&&!Array.isArray(value)?value:null;}catch{return null;}
}
export function writeEditorBackup(key:string,value:Record<string,string>){try{sessionStorage.setItem(scopedKey(key),JSON.stringify(value));}catch{/* The unsaved-navigation warning remains available when storage is blocked. */}}
export function clearEditorBackup(key:string){try{sessionStorage.removeItem(scopedKey(key));}catch{}}
