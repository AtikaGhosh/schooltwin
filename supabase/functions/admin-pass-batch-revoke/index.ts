import { createFunctionHandler } from '../_shared/handler.ts'
Deno.serve(createFunctionHandler('admin-pass-batch-revoke'))
