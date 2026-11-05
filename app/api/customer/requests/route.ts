import { createSavedRequestsHandler } from "../../../../server/saved-requests.js";
export const runtime = "nodejs";
// Local submission view only; not an authenticated external portal.
export const POST = createSavedRequestsHandler({ customerSubmission: true });
