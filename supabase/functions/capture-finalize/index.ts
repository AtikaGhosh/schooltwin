import { createFunctionHandler } from '../_shared/handler.ts'
Deno.serve(createFunctionHandler('capture-finalize'))
