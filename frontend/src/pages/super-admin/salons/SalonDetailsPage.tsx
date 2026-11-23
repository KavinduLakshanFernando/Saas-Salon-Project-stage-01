import { ArrowLeft, Layers3, ShieldCheck, Sparkles, Bell, Zap } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { EditSalonDialog } from '@/features/salons/components/EditSalonDialog';
import { ManageFeaturesDialog } from '@/features/salons/components/ManageFeaturesDialog';
import { StatusBadge } from '@/features/salons/components/StatusBadge';
import { StatusChangeDialog } from '@/features/salons/components/StatusChangeDialog';
import { useSalon } from '@/features/salons/hooks/useSalons';
import type { SalonStatus } from '@/features/salons/types/salon.types';
import { ManageSubscriptionDialog } from '@/features/subscriptions/components/ManageSubscriptionDialog';
import { ManageSubscriptionAddonsDialog } from '@/features/subscriptions/components/ManageSubscriptionAddonsDialog';
import { ManageSubscriptionPlanSection } from '@/features/subscriptions/components/ManageSubscriptionPlanSection';
import { formatPrice } from '@/features/plans/lib/plan-utils';
import { formatSriLankaDate, formatSriLankaDateTime } from '@/lib/sri-lanka-time';
import { OpsError, OpsLoading } from '@/pages/salon/salon-ops-ui';
import './salon-details-page.css';

function subscriptionStatusClass(status: string): string {
  switch (status) {
    case 'ACTIVE':
      return 'emp-badge emp-badge-active';
    case 'PENDING':
      return 'emp-badge emp-badge-inactive';
    default:
      return 'emp-badge emp-type-out';
  }
}

function formatDateTime(value: string | null | undefined): string {
  return formatSriLankaDateTime(value);
}

function formatDate(value: string | null | undefined): string {
  return formatSriLankaDate(value);
}

export default function SalonDetailsPage() {
  const { id = '' } = useParams();
  const { data: salon, isLoading, error, refetch } = useSalon(id);
  const [editOpen, setEditOpen] = useState(false);
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const [subscriptionOpen, setSubscriptionOpen] = useState(false);
  const [addonsOpen, setAddonsOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<SalonStatus | null>(null);

  if (isLoading) return <OpsLoading />;
  if (error || !salon) {
    return <OpsError message="Salon not found." onRetry={() => void refetch()} />;
  }

  return (
    <div className="sd-page">
      <Link to="/super-admin/salons" className="sd-back">
        <ArrowLeft className="h-4 w-4" />
        Back to salons
      </Link>

      <header className="sd-hero">
        <div>
          <h1>{salon.name}</h1>
          <p className="sd-hero-meta">
            {salon.code} · Tenant details and subscription management
          </p>
        </div>
        <div className="sd-hero-actions">
          <button type="button" className="sd-btn sd-btn-secondary" onClick={() => setEditOpen(true)}>
            Edit Salon
          </button>
          <button
            type="button"
            className="sd-btn sd-btn-primary"
            onClick={() => setSubscriptionOpen(true)}
          >
            {salon.subscription ? 'Manage Plan' : 'Assign Plan'}
          </button>
        </div>
      </header>

      {/* HIGH-PRIORITY ACTION REQUIRED BANNER: PENDING PLAN CHANGE */}
      {salon.subscription?.pendingPlan && (
        <div
          className="sd-alert"
          style={{
            border: '2px solid #f59e0b',
            background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.14) 0%, rgba(245, 158, 11, 0.04) 100%)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            marginBottom: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <div
                style={{
                  width: '2.25rem',
                  height: '2.25rem',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(245, 158, 11, 0.2)',
                  color: '#d97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: '0.1rem',
                }}
              >
                <Bell className="h-5 w-5" />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: '#f59e0b',
                    }}
                  />
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: '#b45309',
                    }}
                  >
                    Action Required · Pending Plan Downgrade
                  </span>
                </div>
                <p className="sd-alert-title" style={{ color: '#78350f', margin: '0 0 0.25rem', fontSize: '1rem' }}>
                  Salon requested downgrade to {salon.subscription.pendingPlan.name}
                </p>
                <p className="sd-alert-text" style={{ color: '#92400e', margin: 0, fontSize: '0.85rem' }}>
                  Scheduled to take effect at renewal on{' '}
                  <strong>{formatDate(salon.subscription.nextBillingDate || salon.subscription.endDate)}</strong>.
                  As Super Admin, you can authorize it immediately with prorated billing credit carryover in the management section below.
                </p>
              </div>
            </div>

            <a
              href="#manage-subscription-plan-section"
              className="sd-btn sd-btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: '#d97706',
                borderColor: '#d97706',
                color: '#fff',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '0.8125rem',
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                alignSelf: 'center',
              }}
            >
              <Zap className="h-4 w-4" />
              Take Action Now
            </a>
          </div>
        </div>
      )}

      {salon.awaitingActivation && (
        <div className="sd-alert">
          <p className="sd-alert-title">Payment received — awaiting activation</p>
          <p className="sd-alert-text">
            Customer paid for the {salon.subscription?.planName ?? 'selected'} plan. Activate this
            salon to allow login and enable plan features.
          </p>
          <button type="button" className="sd-btn sd-btn-primary" onClick={() => setStatusTarget('ACTIVE')}>
            Activate Salon
          </button>
        </div>
      )}

      <section className="sd-stats" aria-label="Salon summary">
        <article className="sd-stat-card">
          <div className="sd-stat-icon">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="sd-stat-label">Salon Status</div>
            <div className="sd-stat-value">
              <StatusBadge status={salon.status} />
            </div>
          </div>
        </article>

        <article className="sd-stat-card">
          <div className="sd-stat-icon">
            <Layers3 className="h-5 w-5" />
          </div>
          <div>
            <div className="sd-stat-label">Plan</div>
            <div className="sd-stat-value">{salon.subscription?.planCode ?? 'Manual'}</div>
          </div>
        </article>

        <article className="sd-stat-card">
          <div className="sd-stat-icon">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="sd-stat-label">Enabled Features</div>
            <div className="sd-stat-value">{salon.enabledFeatures.length}</div>
          </div>
        </article>
      </section>

      <div className="sd-layout">
        <div className="sd-main-stack">
          <section className="sd-panel">
            <div className="sd-panel-head">
              <h2 className="sd-panel-title">Subscription</h2>
              <p className="sd-panel-desc">Current billing plan and renewal dates</p>
            </div>
            <div className="sd-panel-body">
              {salon.subscription ? (
                <dl className="sd-detail-list">
                  <div className="sd-detail-item">
                    <dt>Plan</dt>
                    <dd className="sd-detail-strong">
                      {salon.subscription.planName}{' '}
                      <span className={subscriptionStatusClass(salon.subscription.status)}>
                        {salon.subscription.status}
                      </span>
                    </dd>
                  </div>
                  <div className="sd-detail-item">
                    <dt>Base Plan Price</dt>
                    <dd className="sd-detail-strong">
                      {formatPrice(salon.subscription.price, salon.subscription.currency)}
                    </dd>
                  </div>
                  {salon.subscription.totals && salon.subscription.totals.activeAddonsTotal > 0 && (
                    <>
                      <div className="sd-detail-item">
                        <dt>Active Add-ons</dt>
                        <dd className="sd-detail-strong" style={{ color: '#2563eb' }}>
                          + {formatPrice(salon.subscription.totals.activeAddonsTotal, salon.subscription.currency)}
                          {salon.subscription.activeAddonsCount ? ` (${salon.subscription.activeAddonsCount} add-on${salon.subscription.activeAddonsCount > 1 ? 's' : ''})` : ''}
                        </dd>
                      </div>
                      <div className="sd-detail-item">
                        <dt>Next Renewal Total</dt>
                        <dd className="sd-detail-strong" style={{ color: '#16a34a', fontWeight: 700 }}>
                          {formatPrice(salon.subscription.totals.nextRenewalTotal ?? salon.subscription.price, salon.subscription.currency)}
                        </dd>
                      </div>
                    </>
                  )}
                  {salon.subscription.startDate && (
                    <div className="sd-detail-item">
                      <dt>Started</dt>
                      <dd>{formatDate(salon.subscription.startDate)}</dd>
                    </div>
                  )}
                  {salon.subscription.endDate && (
                    <div className="sd-detail-item">
                      <dt>Renews / Ends</dt>
                      <dd>{formatDate(salon.subscription.endDate)}</dd>
                    </div>
                  )}
                  {salon.subscription.billingCreditBalance !== undefined && salon.subscription.billingCreditBalance > 0 && (
                    <div className="sd-detail-item">
                      <dt>Billing Credit Balance</dt>
                      <dd className="sd-detail-strong" style={{ color: '#059669', fontWeight: 700 }}>
                        {formatPrice(salon.subscription.billingCreditBalance, salon.subscription.currency)}
                      </dd>
                    </div>
                  )}
                </dl>
              ) : (
                <div className="sd-empty">
                  No subscription assigned. Features are managed manually for this legacy salon.
                </div>
              )}
            </div>
          </section>

          {salon.subscription && (
            <ManageSubscriptionPlanSection
              tenantId={salon.id}
              salonName={salon.name}
              subscription={salon.subscription as any}
              onSuccess={() => void refetch()}
            />
          )}

          <section className="sd-panel">
            <div className="sd-panel-head">
              <h2 className="sd-panel-title">Salon Information</h2>
              <p className="sd-panel-desc">Contact details and tenant admin</p>
            </div>
            <div className="sd-panel-body">
              <dl className="sd-detail-list">
                <div className="sd-detail-item">
                  <dt>Email</dt>
                  <dd>{salon.email || '—'}</dd>
                </div>
                <div className="sd-detail-item">
                  <dt>Phone</dt>
                  <dd>{salon.phone || '—'}</dd>
                </div>
                <div className="sd-detail-item">
                  <dt>Created</dt>
                  <dd>{formatDateTime(salon.createdAt)}</dd>
                </div>
                <div className="sd-detail-item">
                  <dt>Main Branch</dt>
                  <dd>{salon.mainBranch?.name ?? '—'}</dd>
                </div>
                <div className="sd-detail-item">
                  <dt>Admin</dt>
                  <dd>
                    {salon.admin ? (
                      <>
                        <span className="sd-detail-strong">{salon.admin.name}</span>
                        <br />
                        <span className="sd-detail-muted">{salon.admin.email}</span>
                      </>
                    ) : (
                      '—'
                    )}
                  </dd>
                </div>
              </dl>
            </div>
          </section>
        </div>

        <aside className="sd-sidebar-stack">
          <section className="sd-panel">
            <div className="sd-panel-head">
              <h2 className="sd-panel-title">Quick Actions</h2>
              <p className="sd-panel-desc">Manage plan, features, and salon status</p>
            </div>
            <div className="sd-panel-body">
              <div className="sd-action-stack">
                <button
                  type="button"
                  className="sd-btn sd-btn-secondary"
                  onClick={() => setFeaturesOpen(true)}
                >
                  Manage Features
                </button>
                <button
                  type="button"
                  className="sd-btn sd-btn-secondary"
                  onClick={() => setSubscriptionOpen(true)}
                >
                  {salon.subscription ? 'Change Plan' : 'Assign Plan'}
                </button>
                {salon.subscription && (
                  <button
                    type="button"
                    className="sd-btn sd-btn-secondary"
                    onClick={() => setAddonsOpen(true)}
                  >
                    Manage Paid Add-ons
                  </button>
                )}

                <div className="sd-action-divider" />

                {salon.status !== 'ACTIVE' && (
                  <button
                    type="button"
                    className="sd-btn sd-btn-primary"
                    onClick={() => setStatusTarget('ACTIVE')}
                  >
                    Activate Salon
                  </button>
                )}
                {salon.status !== 'SUSPENDED' && (
                  <button
                    type="button"
                    className="sd-btn sd-btn-secondary"
                    onClick={() => setStatusTarget('SUSPENDED')}
                  >
                    Suspend Salon
                  </button>
                )}
                {salon.status !== 'ARCHIVED' && (
                  <button
                    type="button"
                    className="sd-btn sd-btn-danger"
                    onClick={() => setStatusTarget('ARCHIVED')}
                  >
                    Archive Salon
                  </button>
                )}
              </div>
            </div>
          </section>

          <section className="sd-panel">
            <div className="sd-panel-head">
              <h2 className="sd-panel-title">Enabled Features</h2>
              <p className="sd-panel-desc">
                {salon.featuresManagedBySubscription
                  ? 'Module access for this subscription-managed salon'
                  : 'Manually assigned modules'}
              </p>
            </div>
            <div className="sd-panel-body">
              {salon.enabledFeatures.length ? (
                <div className="sd-feature-grid">
                  {salon.enabledFeatures.map((feature) => (
                    <div key={feature.code} className="sd-feature-chip">
                      <span className="sd-feature-name">{feature.name}</span>
                      <span className="sd-feature-code">{feature.code}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="sd-empty">
                  {salon.subscription?.status === 'PENDING'
                    ? 'Features activate after the subscription is activated.'
                    : 'No features enabled.'}
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>

      <EditSalonDialog salon={salon} open={editOpen} onOpenChange={setEditOpen} />
      <ManageFeaturesDialog salon={salon} open={featuresOpen} onOpenChange={setFeaturesOpen} />
      <ManageSubscriptionDialog
        tenantId={salon.id}
        salonName={salon.name}
        subscription={salon.subscription}
        open={subscriptionOpen}
        onOpenChange={setSubscriptionOpen}
      />
      {salon.subscription && (
        <ManageSubscriptionAddonsDialog
          subscriptionId={salon.subscription.id}
          salonName={salon.name}
          open={addonsOpen}
          onOpenChange={setAddonsOpen}
          onSuccess={() => void refetch()}
        />
      )}
      {statusTarget && (
        <StatusChangeDialog
          salonId={salon.id}
          salonName={salon.name}
          targetStatus={statusTarget}
          open={!!statusTarget}
          onOpenChange={(open) => !open && setStatusTarget(null)}
        />
      )}
    </div>
  );
}
