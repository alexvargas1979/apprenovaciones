import Workspace from "./workspace";
import { requireAppUser } from '@/lib/auth/identity';
export const dynamic='force-dynamic';
export default async function Home(){await requireAppUser('/');return <Workspace/>}
