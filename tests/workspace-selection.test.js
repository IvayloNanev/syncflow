import test from 'node:test';
import assert from 'node:assert/strict';
import {selectWorkspace} from '../lib/workspace-selection.js';
const own={workspace_id:'own',role:'owner'},sandbox={workspace_id:'sandbox',role:'member'};
test('workspace preference requires current membership, including revoked access',()=>{
 assert.equal(selectWorkspace([own,sandbox],'sandbox'),sandbox);
 assert.equal(selectWorkspace([own,sandbox],'foreign'),own);
 assert.equal(selectWorkspace([own],'sandbox'),own);
 assert.equal(selectWorkspace([],'sandbox'),null);
 assert.equal(selectWorkspace([own,sandbox],undefined),own);
 assert.equal(selectWorkspace([own],undefined),own);
});
