import { NextRequest, NextResponse } from 'next/server';

// Add your Dune API key to your .env.local file
const DUNE_API_KEY = process.env.DUNE_API_KEY || "7mD4A9p6ESibvjZZOc6FJzOqVrjtPMxb";



if (!DUNE_API_KEY) {
  console.error('DUNE_API_KEY environment variable is not set');
}

export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const body = await request.json();
    const { queryId, limit = 1000, asset, offset = 0 } = body;

    console.log(`[Dune Proxy] Request for queryId: ${queryId}, limit: ${limit}, asset: ${asset}, offset: ${offset}`);

    if (!queryId) {
      return NextResponse.json(
        { error: 'queryId is required' },
        { status: 400 }
      );
    }

    if (!DUNE_API_KEY) {
      return NextResponse.json(
        { error: 'Dune API key not configured' },
        { status: 500 }
      );
    }

    // If asset filtering is requested, we'll paginate to find the asset
    if (asset) {
      return await fetchAssetDataWithPagination(queryId, asset, limit);
    }

    // Otherwise, make a simple request
    const duneUrl = `https://api.dune.com/api/v1/query/${queryId}/results?limit=${limit}&offset=${offset}`;
    
    console.log(`[Dune Proxy] Calling Dune API: ${duneUrl}`);

    const duneResponse = await fetch(duneUrl, {
      method: 'GET',
      headers: {
        'X-Dune-API-Key': DUNE_API_KEY,
        'Accept': 'application/json',
        'User-Agent': 'Funding-Arbitrage-App/1.0',
      },
    });

    console.log(`[Dune Proxy] Dune API response status: ${duneResponse.status}`);

    if (!duneResponse.ok) {
      const errorText = await duneResponse.text();
      console.error(`[Dune Proxy] Dune API error: ${duneResponse.status} - ${errorText}`);
      
      return NextResponse.json(
        { 
          error: 'Dune API request failed',
          status: duneResponse.status,
          message: errorText,
        },
        { status: duneResponse.status }
      );
    }

    const duneData = await duneResponse.json();
    return NextResponse.json(duneData);

  } catch (error) {
    console.error('[Dune Proxy] Error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Function to paginate through Dune data and filter for specific asset
async function fetchAssetDataWithPagination(queryId: string, targetAsset: string, maxRows: number = 1000) {
  const allAssetRows: any[] = [];
  let offset = 0;
  const pageSize = 1000; // Dune's max limit
  let totalRowsChecked = 0;
  const maxRowsToCheck = 50000; // Safety limit to avoid infinite loops
  
  console.log(`[Dune Proxy] Starting asset pagination for: ${targetAsset}`);
  
  while (allAssetRows.length < maxRows && totalRowsChecked < maxRowsToCheck) {
    const duneUrl = `https://api.dune.com/api/v1/query/${queryId}/results?limit=${pageSize}&offset=${offset}`;
    
    console.log(`[Dune Proxy] Fetching page: offset=${offset}, limit=${pageSize}`);
    
    try {
      const duneResponse = await fetch(duneUrl, {
        method: 'GET',
        headers: {
          'X-Dune-API-Key': DUNE_API_KEY!,
          'Accept': 'application/json',
          'User-Agent': 'Funding-Arbitrage-App/1.0',
        },
      });

      if (!duneResponse.ok) {
        console.error(`[Dune Proxy] Page fetch failed: ${duneResponse.status}`);
        break;
      }

      const pageData = await duneResponse.json();
      const rows = pageData.result?.rows || [];
      
      if (rows.length === 0) {
        console.log(`[Dune Proxy] No more data available at offset ${offset}`);
        break;
      }
      
      console.log(`[Dune Proxy] Processing ${rows.length} rows from offset ${offset}`);
      
      // Filter rows for the target asset
      const assetRows = rows.filter((row: any) => {
        const marketName = row.market_name || row.market_name_avax || row.market_name_arb || '';
        const assetFromMarket = marketName.split('/')[0]?.trim().toUpperCase() || '';
        return assetFromMarket === targetAsset.toUpperCase();
      });
      
      if (assetRows.length > 0) {
        console.log(`[Dune Proxy] Found ${assetRows.length} rows for ${targetAsset} in this page`);
        allAssetRows.push(...assetRows);
        
        // Log sample of found data
        console.log(`[Dune Proxy] Sample ${targetAsset} data:`, JSON.stringify(assetRows.slice(0, 2), null, 2));
      }
      
      totalRowsChecked += rows.length;
      
      // Check if we have next page info
      const nextOffset = pageData.next_offset;
      if (nextOffset && nextOffset > offset) {
        offset = nextOffset;
      } else {
        offset += pageSize;
      }
      
      // If we got less than a full page, we're at the end
      if (rows.length < pageSize) {
        console.log(`[Dune Proxy] Reached end of data (got ${rows.length} < ${pageSize})`);
        break;
      }
      
    } catch (error) {
      console.error(`[Dune Proxy] Error fetching page at offset ${offset}:`, error);
      break;
    }
  }
  
  console.log(`[Dune Proxy] Pagination complete. Found ${allAssetRows.length} rows for ${targetAsset} after checking ${totalRowsChecked} total rows`);
  
  // Return in the same format as Dune API
  return NextResponse.json({
    result: {
      rows: allAssetRows.slice(0, maxRows) // Limit to requested number
    },
    execution_id: `filtered-${targetAsset}-${Date.now()}`,
    query_id: queryId,
    is_execution_finished: true,
    state: "QUERY_STATE_COMPLETED"
  });
}

// Handle GET requests (optional - for testing)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const queryId = searchParams.get('queryId') || '4562744';
  const limit = searchParams.get('limit') || '100';
  const asset = searchParams.get('asset') || 'BTC';
  const offset = searchParams.get('offset') || '0';

  console.log(`[Dune Proxy] GET request - queryId: ${queryId}, limit: ${limit}, asset: ${asset}, offset: ${offset}`);

  // Convert GET to POST format and reuse POST logic
  const mockRequest = {
    json: async () => ({ 
      queryId, 
      limit: parseInt(limit), 
      asset,
      offset: parseInt(offset)
    })
  } as NextRequest;

  return POST(mockRequest);
}