import { memo } from "react";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { Badge } from "../ui/badge";
import { ArbitrageOpportunity } from "@/lib/types";


export const OpportunityRow = memo(({ 
  opportunity, 
  formatRate, 
  formatAPR, 
  formatSmallOI,
  onClick
}: {
  opportunity: ArbitrageOpportunity;
  formatRate: (rate: number) => string;
  formatAPR: (apr: number) => string;
  formatSmallOI: (oi: number) => string;
  onClick: (opportunity: ArbitrageOpportunity) => void;
}) => (
  <HoverCard>
    <HoverCardTrigger asChild>
      <tr className="border-b hover:bg-blue-50 cursor-pointer transition-colors"
          onClick={() => onClick(opportunity)} 
      >    
        <td className="pl-4 py-3 font-medium">{opportunity.asset}</td>
        <td className={`pr-1 py-3 ${
          !opportunity.driftData.available ? "" :
          opportunity.driftData.rate > 0 ? "text-green-600" : 
          opportunity.driftData.rate < 0 ? "text-red-600" : ""
        }`}>
          {opportunity.driftData.available ? formatRate(opportunity.driftData.rate) : "-"}
        </td>
        <td className={`px-1 py-3 ${
          !opportunity.hyperliquidData.available ? "" :
          opportunity.hyperliquidData.rate > 0 ? "text-green-600" : 
          opportunity.hyperliquidData.rate < 0 ? "text-red-600" : ""
        }`}>
          {opportunity.hyperliquidData.available ? formatRate(opportunity.hyperliquidData.rate) : "-"}
        </td>
        <td className={`px-1 py-3 ${
          !opportunity.gmxData.available ? "" :
          opportunity.gmxData.rate > 0 ? "text-green-600" : 
          opportunity.gmxData.rate < 0 ? "text-red-600" : ""
        }`}>
          {opportunity.gmxData.available ? formatRate(opportunity.gmxData.rate) : "-"}
        </td>
        <td className={`px-1 py-3 ${
          !opportunity.lighterData.available ? "" :
          opportunity.lighterData.rate > 0 ? "text-green-600" : 
          opportunity.lighterData.rate < 0 ? "text-red-600" : ""
        }`}>
          {opportunity.lighterData.available ? formatRate(opportunity.lighterData.rate) : "-"}
        </td>
        <td className={`px-1 py-3 ${
          !opportunity.paradexData.available ? "" :
          opportunity.paradexData.rate > 0 ? "text-green-600" : 
          opportunity.paradexData.rate < 0 ? "text-red-600" : ""
        }`}>
          {opportunity.paradexData.available ? formatRate(opportunity.paradexData.rate) : "-"}
        </td>
        <td className="px-4 py-3">
          <Badge variant={opportunity.maxSpread > 0.001 ? "default" : "secondary"}>
            {formatRate(opportunity.maxSpread)}
          </Badge>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1">
            <span className={
              opportunity.currentAPR > 20 ? "text-green-600 font-semibold" : 
              opportunity.currentAPR > 10 ? "text-yellow-600" : ""
            }>
              {formatAPR(opportunity.currentAPR)}
            </span>
          </div>
        </td>
        <td className="px-4 py-3 text-sm">{opportunity.bestStrategy}</td>
        <td className="px-4 py-3 text-xs flex flex-col space-y-0.5">
          {opportunity.openInterestHyperliquid ? (
            <div className="whitespace-nowrap">H - {formatSmallOI(opportunity.openInterestHyperliquid)}</div>
          ) : null}
          {opportunity.openInterestLighter ? (
            <div className="whitespace-nowrap">L - {formatSmallOI(opportunity.openInterestLighter)}</div>
          ) : null}
          {opportunity.openInterestDrift ? (
            <div className="whitespace-nowrap">D - {formatSmallOI(opportunity.openInterestDrift)}</div>
          ) : null}
          {opportunity.gmxMarket?.openInterestLong && opportunity.gmxMarket?.openInterestShort ? (
            <div className="whitespace-nowrap">G - {formatSmallOI((parseFloat(opportunity.gmxMarket.openInterestLong) + parseFloat(opportunity.gmxMarket.openInterestShort)) / 1e30)}</div>
          ) : null}
          {opportunity.gmxMarket?.openInterestLong && opportunity.gmxMarket?.openInterestShort && opportunity.gmxMarket?.indexPrice ? (
            <div className="whitespace-nowrap">S - {  ((parseFloat(opportunity.gmxMarket.openInterestLong) + parseFloat(opportunity.gmxMarket.openInterestShort)) / 1e30) *
          parseFloat(opportunity.gmxMarket.indexPrice)
        }</div>
          ) : null}
          {opportunity.openInterestParadex ? (
            <div className="whitespace-nowrap">P - {formatSmallOI(opportunity.openInterestParadex)}</div>
          ) : null}
        </td>
        {/* <td className="px-4 py-3">{opportunity.maxPriceDeviation.toFixed(3)}%</td> */}
      </tr>
    </HoverCardTrigger>
    <HoverCardContent className="w-80 text-xs space-y-3 p-4 border shadow-lg rounded-md bg-popover text-popover-foreground dark:bg-zinc-900 dark:text-zinc-100">
      {opportunity.driftContract && (
        <div className="p-2 rounded-md" style={{ backgroundColor: '#ffedd8' }}>
          <h4 className="font-medium text-sm mb-1">Drift</h4>
          <ul className="space-y-0.5">
            <li>Funding: {formatRate(opportunity.driftData.rate)}</li>
            <li>OI: {formatSmallOI(opportunity.openInterestDrift)}</li>
            <li>Price: {parseFloat(opportunity.driftContract.index_price).toFixed(3)}</li>
            <li>24h Vol: {parseFloat(opportunity.driftContract.quote_volume).toLocaleString(undefined, { maximumFractionDigits: 0 })}</li>
          </ul>
        </div>
      )}
      {opportunity.hyperliquidContext && (
        <div className="p-2 rounded-md" style={{ backgroundColor: '#c4fff1' }}>
          <h4 className="font-medium text-sm mb-1">Hyperliquid</h4>
          <ul className="space-y-0.5">
            <li>Funding: {formatRate(opportunity.hyperliquidData.rate)}</li>
            <li>OI: {formatSmallOI(opportunity.openInterestHyperliquid)}</li>
            <li>Mark Px: {parseFloat(opportunity.hyperliquidContext.markPx).toFixed(3)}</li>
            <li>24h Vlm: {parseFloat(opportunity.hyperliquidContext.dayNtlVlm).toLocaleString(undefined, { maximumFractionDigits: 0 })}</li>
          </ul>
        </div>
      )}
      {opportunity.gmxMarket && (
        <div className="p-2 rounded-md">
          <h4 className="font-medium text-sm mb-1">GMX</h4>
          <ul className="space-y-0.5">
            <li>Funding: {formatRate(opportunity.gmxData.rate)}</li>
            {opportunity.gmxMarket.openInterestLong && opportunity.gmxMarket.openInterestShort && (
              <li>
                OI L/S: {formatSmallOI(parseFloat(opportunity.gmxMarket.openInterestLong) / 1e30)} / {formatSmallOI(parseFloat(opportunity.gmxMarket.openInterestShort) / 1e30)}
              </li>
            )}
            {opportunity.gmxMarket.indexPrice && (
              <li>Index Px: {(parseFloat(opportunity.gmxMarket.indexPrice) / 1e30).toFixed(2)}</li>
            )}
            {opportunity.gmxMarket.volume24h && (
              <li>24h Vol: {(parseFloat(opportunity.gmxMarket.volume24h) / 1e30).toLocaleString(undefined, { maximumFractionDigits: 0 })}</li>
            )}
          </ul>
        </div>
      )}
      {opportunity.lighterStats && (
        <div className="p-2 rounded-md" style={{ backgroundColor: '#EEF6FF' }}>
          <h4 className="font-medium text-sm mb-1">Lighter</h4>
          <ul className="space-y-0.5">
            <li>Funding: {formatRate(opportunity.lighterData.rate)}</li>
            <li>OI: {formatSmallOI(opportunity.openInterestLighter)}</li>
            <li>Index Px: {parseFloat(opportunity.lighterStats.index_price).toFixed(3)}</li>
            <li>24h Vol: {opportunity.lighterStats.daily_quote_token_volume.toLocaleString(undefined, { maximumFractionDigits: 0 })}</li>
          </ul>
        </div>
      )}
      {opportunity.paradexMarket && (
        <div className="p-2 rounded-md bg-purple-100">
          <h4 className="font-medium text-sm mb-1">Paradex</h4>
          <ul className="space-y-0.5">
            <li>Funding: {formatRate(opportunity.paradexData.rate)}</li>
            <li>OI: {formatSmallOI(opportunity.openInterestParadex)}</li>
            <li>Underlying Px: {parseFloat(opportunity.paradexMarket.underlying_price).toFixed(3)}</li>
            <li>24h Vol: {parseFloat(opportunity.paradexMarket.volume_24h).toLocaleString(undefined, { maximumFractionDigits: 0 })}</li>
          </ul>
        </div>
      )}
      <div className="pt-2 text-[11px] italic text-muted-foreground">Click row to view historical data</div>
    </HoverCardContent>
  </HoverCard>
));


OpportunityRow.displayName = 'OpportunityRow';
