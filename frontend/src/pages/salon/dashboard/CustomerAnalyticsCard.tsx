import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowUpRight, CalendarDays, Users } from 'lucide-react';

interface CustomerAnalyticsCardProps {
  totalCustomers?: number;
  newCustomers?: number;
  bookings?: number;
  trend?: Array<{
    date: string;
    completed: number;
    confirmed: number;
    pending?: number;
    cancelled: number;
    noShow?: number;
  }>;
}

export function CustomerAnalyticsCard({
  totalCustomers = 0,
  newCustomers = 0,
  bookings = 0,
  trend = [],
}: CustomerAnalyticsCardProps) {
  const chartData = trend.map((item) => ({
    ...item,
    bookings: item.completed + item.confirmed + (item.pending ?? 0) + item.cancelled + (item.noShow ?? 0),
    label: new Date(`${item.date}T00:00:00`).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    }),
  }));

  const midpoint = Math.ceil(chartData.length / 2);
  const firstHalfBookings = chartData.slice(0, midpoint).reduce((sum, item) => sum + item.bookings, 0);
  const secondHalfBookings = chartData.slice(midpoint).reduce((sum, item) => sum + item.bookings, 0);
  const bookingGrowth = firstHalfBookings > 0
    ? Math.round(((secondHalfBookings - firstHalfBookings) / firstHalfBookings) * 100)
    : secondHalfBookings > 0 ? 100 : 0;
  const hasGrowthComparison = chartData.length > 1;

  return (
    <section className="dash-card dash-customer-analytics-card" aria-labelledby="customer-analytics-title">
      <div className="dash-card-header">
        <div className="dash-card-title-group">
          <h2 id="customer-analytics-title">Customer Analytics</h2>
          <p>Track customer growth and booking activity.</p>
        </div>
        <Link to="/salon/customers?tab=analytics" className="dash-header-view-all">
          View All <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="dash-customer-analytics-stats">
        <div className="dash-customer-analytics-stat">
          <div className="dash-customer-analytics-icon text-violet-700 bg-violet-50">
            <Users className="h-4 w-4" />
          </div>
          <div>
            <strong>{totalCustomers.toLocaleString()}</strong>
            <span>Total customers</span>
          </div>
        </div>
        <div className="dash-customer-analytics-stat">
          <div className="dash-customer-analytics-icon text-emerald-700 bg-emerald-50">
            <ArrowUpRight className="h-4 w-4" />
          </div>
          <div>
            <strong>{newCustomers.toLocaleString()}</strong>
            <span>New this period</span>
          </div>
        </div>
        <div className="dash-customer-analytics-stat">
          <div className="dash-customer-analytics-icon text-blue-700 bg-blue-50">
            <CalendarDays className="h-4 w-4" />
          </div>
          <div>
            <strong>{bookings.toLocaleString()}</strong>
            <span>Bookings this period</span>
          </div>
        </div>
      </div>

      <div className="dash-customer-bookings-heading">
        <span>Booking activity</span>
        {hasGrowthComparison && (
          <span className={bookingGrowth >= 0 ? 'is-positive' : 'is-negative'}>
            {bookingGrowth >= 0 ? '+' : ''}{bookingGrowth}% in latter half
          </span>
        )}
      </div>

      <div className="dash-customer-bookings-chart">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id="customerBookingsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--brand-primary, #7c3aed)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="var(--brand-primary, #7c3aed)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Tooltip
                labelFormatter={(_, payload) => payload?.[0]?.payload?.label ?? ''}
                formatter={(value) => [value, 'Bookings']}
                contentStyle={{ borderRadius: 8, borderColor: '#e2e8f0', fontSize: 12 }}
              />
              <Area
                type="monotone"
                dataKey="bookings"
                stroke="var(--brand-primary, #7c3aed)"
                strokeWidth={2.5}
                fill="url(#customerBookingsFill)"
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="dash-customer-bookings-empty">Booking activity will appear here when available.</div>
        )}
      </div>
    </section>
  );
}
