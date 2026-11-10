import { BagIcon, BuildingIcon, ClockIcon, DocIcon, GridIcon, KeyIcon, ListIcon, ShopIcon, SlidersIcon, TruckIcon, UserIcon, UsersIcon, WalletIcon, ShieldIcon } from '../Icons'
import { AccountPage } from './Account'
import { AdminRoles, AdminUsers, AdminVerification } from './Admin'
import { AdminLogs } from './Logs'
import { AdminCommission, AdminInsights, AdminLedger, AdminListings, AdminOrders } from './Console'
import { BuyerOverview, CorporateOverview, LogisticsOverview, SellerOverview } from './Overviews'
import { AdminPayouts, SellerEarnings } from './Finance'
import { BuyerOrders, SellerListings, SellerPartners, SellerSales } from './Market'
import { AdminTenders, CorporateTenders, SellerTenders } from './Tenders'

// Each kind of role's dashboard: the pages in its menu. The first one opens after login. A page with `perm`
// shows only when the role has that permission (the admin sets them per role on the Roles page), so a role an
// admin made gets its kind's dashboard minus what it may not do.
const account = { path: 'account', label: 'Account', icon: UserIcon, element: <AccountPage /> }

export const DASHBOARDS = {
  buyer: [
    { path: '', label: 'Overview', icon: GridIcon, element: <BuyerOverview /> },
    { path: 'orders', label: 'Orders', icon: BagIcon, element: <BuyerOrders />, perm: 'market.buy' },
    account,
  ],
  corporate: [
    { path: '', label: 'Overview', icon: GridIcon, element: <CorporateOverview /> },
    { path: 'tenders', label: 'Tenders', icon: DocIcon, element: <CorporateTenders />, perm: 'tenders.create' },
    { path: 'orders', label: 'Orders', icon: BagIcon, element: <BuyerOrders />, perm: 'market.buy' },
    account,
  ],
  seller: [
    { path: '', label: 'Overview', icon: GridIcon, element: <SellerOverview /> },
    { path: 'listings', label: 'Listings', icon: ShopIcon, element: <SellerListings />, perm: 'market.sell' },
    { path: 'orders', label: 'Orders', icon: BagIcon, element: <SellerSales />, perm: 'market.sell' },
    { path: 'tenders', label: 'Tenders', icon: DocIcon, element: <SellerTenders />, perm: 'tenders.bid' },
    { path: 'partners', label: 'Pickup & partners', icon: TruckIcon, element: <SellerPartners />, perm: 'market.sell' },
    { path: 'payouts', label: 'Balance & payouts', icon: WalletIcon, element: <SellerEarnings />, perm: 'payouts.request' },
    account,
  ],
  logistics: [
    { path: '', label: 'Overview', icon: GridIcon, element: <LogisticsOverview /> },
    account,
  ],
  admin: [
    { path: '', label: 'Overview', icon: GridIcon, element: <AdminInsights />, perm: 'admin.analytics' },
    { path: 'verification', label: 'Verification', icon: ShieldIcon, element: <AdminVerification />, perm: 'admin.verify' },
    { path: 'users', label: 'Users', icon: UsersIcon, element: <AdminUsers />, perm: 'admin.users' },
    { path: 'roles', label: 'Roles', icon: KeyIcon, element: <AdminRoles />, perm: 'admin.roles' },
    { path: 'listings', label: 'Listings', icon: ShopIcon, element: <AdminListings />, perm: 'admin.market' },
    { path: 'orders', label: 'Orders', icon: BagIcon, element: <AdminOrders />, perm: 'admin.market' },
    { path: 'tenders', label: 'Tenders', icon: DocIcon, element: <AdminTenders />, perm: 'admin.market' },
    { path: 'payouts', label: 'Payments & payouts', icon: WalletIcon, element: <AdminPayouts />, perm: 'admin.finance' },
    { path: 'ledger', label: 'Ledger', icon: ListIcon, element: <AdminLedger />, perm: 'admin.finance' },
    { path: 'commission', label: 'Commission', icon: SlidersIcon, element: <AdminCommission />, perm: 'admin.finance' },
    { path: 'logs', label: 'Logs', icon: ClockIcon, element: <AdminLogs />, perm: 'admin.logs' },
    account,
  ],
}

export const ROLE_ICONS = { buyer: BagIcon, corporate: BuildingIcon, seller: ShopIcon, logistics: TruckIcon, admin: ShieldIcon }

/** The pages this login may open, in menu order. An admin role without analytics opens on its first page. */
export function pagesFor(auth) {
  const all = DASHBOARDS[auth.role] ?? DASHBOARDS.buyer
  const pages = all.filter((page) => !page.perm || auth.can(page.perm))
  return pages
}
