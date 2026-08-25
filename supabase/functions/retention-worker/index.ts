import { createFunctionHandler } from '../_shared/handler.ts'
Deno.serve(createFunctionHandler('retention-worker'))
