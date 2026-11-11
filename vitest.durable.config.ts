import {defineConfig} from 'vitest/config';
import {workflow} from '@workflow/vitest';
export default defineConfig({plugins:[workflow({rootDir:".workflow-vitest"})],test:{include:['tests/*.integration.ts'],testTimeout:60000,fileParallelism:false}});
