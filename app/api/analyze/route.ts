import {sharedConfigured} from "../../../lib/supabase/server";
import { createBrowserAnalysisHandler } from "../../../server/browser-analysis.js";

export const runtime = "nodejs";
const localPOST = createBrowserAnalysisHandler();

export async function POST(req:Request){if(sharedConfigured())return Response.json({error:{message:"Use the authenticated coordinator workspace."}},{status:410});return localPOST(req);}
