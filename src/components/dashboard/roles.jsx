import { BagIcon, BuildingIcon, ClockIcon, DocIcon, GridIcon, ShopIcon, TruckIcon, UserIcon, UsersIcon, WalletIcon, ShieldIcon } from '../Icons'
import { AccountPage } from './Account'
import { AdminActivity, AdminOverview, AdminUsers, AdminVerification } from './Admin'
import { BuyerOverview, CorporateOverview, LogisticsOverview, SellerOverview } from './Overviews'
import { AdminPayouts, SellerEarnings } from './Finance'
import { BuyerOrders, SellerListings, SellerPartners, SellerSales } from './Market'
import { AdminTenders, CorporateTenders, SellerTenders } from './Tenders'

// Each role's dashboard: the pages in its menu. The first one opens after login.
const account = { path: 'account', label: 'Account', icon: UserIcon, element: <AccountPage /> }

export const DASHBOARDS = {
  buyer: [
    { path: '', label: 'Overview', icon: GridIcon, element: <BuyerOverview /> },
    { path: 'orders', label: 'Orders', icon: BagIcon, element: <BuyerOrders /> },
    account,
  ],
  corporate: [
    { path: '', label: 'Overview', icon: GridIcon, element: <CorporateOverview /> },
    { path: 'tenders', label: 'Tenders', icon: DocIcon, element: <CorporateTenders /> },
    { path: 'orders', label: 'Orders', icon: BagIcon, element: <BuyerOrders /> },
    account,
  ],
  seller: [
    { path: '', label: 'Overview', icon: GridIcon, element: <SellerOverview /> },
    { path: 'listings', label: 'Listings', icon: ShopIcon, element: <SellerListings /> },
    { path: 'orders', label: 'Orders', icon: BagIcon, element: <SellerSales /> },
    { path: 'tenders', label: 'Tenders', icon: DocIcon, element: <SellerTenders /> },
    { path: 'partners', label: 'Pickup & partners', icon: TruckIcon, element: <SellerPartners /> },
    { path: 'payouts', label: 'Balance & payouts', icon: WalletIcon, element: <SellerEarnings /> },
    account,
  ],
  logistics: [
    { path: '', label: 'Overview', icon: GridIcon, element: <LogisticsOverview /> },
    account,
  ],
  admin: [
    { path: '', label: 'Overview', icon: GridIcon, element: <AdminOverview /> },
    { path: 'verification', label: 'Verification', icon: ShieldIcon, element: <AdminVerification /> },
    { path: 'users', label: 'Users', icon: UsersIcon, element: <AdminUsers /> },
    { path: 'tenders', label: 'Tenders', icon: DocIcon, element: <AdminTenders /> },
    { path: 'payouts', label: 'Payments & payouts', icon: WalletIcon, element: <AdminPayouts /> },
    { path: 'activity', label: 'Activity', icon: ClockIcon, element: <AdminActivity /> },
    account,
  ],
}

export const ROLE_ICONS = { buyer: BagIcon, corporate: BuildingIcon, seller: ShopIcon, logistics: TruckIcon, admin: ShieldIcon }
