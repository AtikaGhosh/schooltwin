import { createFunctionHandler } from '../_shared/handler.ts'
Deno.serve(createFunctionHandler('device-revoke'))
