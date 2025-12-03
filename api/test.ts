import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    console.log('[Test API] Function called!');
    console.log('[Test API] Method:', req.method);
    console.log('[Test API] URL:', req.url);
    console.log('[Test API] Query:', JSON.stringify(req.query));
    
    res.status(200).json({
      message: 'Test API is working!',
      method: req.method,
      url: req.url,
      query: req.query,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[Test API] Error:', error);
    console.error('[Test API] Error stack:', error?.stack);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error?.message || 'Unknown error',
      stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
    });
  }
}

