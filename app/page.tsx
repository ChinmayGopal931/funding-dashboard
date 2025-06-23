import DriftFundingRatesChart from "@/components/DriftfundingRateChart";
import FundingRatesChart from "@/components/FundingRatesChart";

export default function Home() {
  return (
    <div >
      <FundingRatesChart />
      <DriftFundingRatesChart />

    </div>
  );
}
