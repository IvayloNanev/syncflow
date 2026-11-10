import {managerDecisionToken} from './manager-decision.js';
// A user choice applies only to the current conversation and review scope.
export function activeAgentAssignment(c){const assignment=c.agent_assignment;return assignment?.scope_token===managerDecisionToken({...c,agent_assignment:null})?assignment:null;}
