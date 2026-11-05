import {sharedConfigured} from "../../../../lib/supabase/server";
import { createSavedRequestsHandler } from "../../../../server/saved-requests.js";
export const runtime = "nodejs";
// Local submission view only; not an authenticated external portal.
const localPOST = createSavedRequestsHandler({ customerSubmission: true });

export async function POST(req:Request){if(sharedConfigured())return Response.json({error:{message:"Use the authenticated coordinator workspace."}},{status:410});return localPOST(req);}
