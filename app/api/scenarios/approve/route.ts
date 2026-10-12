import { computedScenario } from '@/lib/postgres/computed-scenario-server';
export const POST = (req: Request) => computedScenario(req, true);
