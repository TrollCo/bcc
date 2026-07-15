import { createApi } from '../../server/handler';

const api = createApi();

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', process.env.BCCC_CORS_ORIGIN ?? '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? 'unknown';
  const result = await api.handle(req.method, req.url, req.body, ip);
  res.status(result.status).json(result.json);
}

