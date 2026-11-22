import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { handleFor, requireUser } from '../../shared/wallet.ts';
import { resolveMarket } from '../../shared/props.ts';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await requireUser(base44);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const marketId = String(body.market_id || '').trim();
    const raw = String(body.result || '').toLowerCase();
    const result = raw === 'yes' || raw === 'no' || raw === 'void' ? raw : '';
    const note = String(body.note || '').trim();

    if (!marketId) return Response.json({ error: 'market_id is required' }, { status: 400 });
    if (!result) return Response.json({ error: 'Resolve the market as yes, no or void.' }, { status: 400 });

    const market = await base44.asServiceRole.entities.PropMarket.get(marketId).catch((e) => {
      if (e.status === 404) return null;
      throw e;
    });
    if (!market) return Response.json({ error: 'Market not found' }, { status: 404 });
    if (market.status === 'resolved' || market.status === 'void') {
      return Response.json({ error: 'This market is already resolved.' }, { status: 400 });
    }

    const resolved = await resolveMarket(base44, market, result, note, handleFor(user));

    return Response.json({ market: resolved });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}