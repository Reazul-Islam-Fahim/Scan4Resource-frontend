import { BagIcon, BuildingIcon, ClockIcon, DocIcon, GridIcon, ShopIcon, TruckIcon, UserIcon, UsersIcon, WalletIcon, ShieldIcon } from '../Icons'
import { AccountPage } from './Account'
import { AdminActivity, AdminOverview, AdminUsers, AdminVerification } from './Admin'
import { BuyerOverview, CorporateOverview, LogisticsOverview, SellerOverview } from './Overviews'
import EmptyPanel from './EmptyPanel'
import { BuyerOrders, SellerListings, SellerPartners, SellerSales } from './Market'

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
    { path: 'tenders', label: 'Tenders', icon: DocIcon, element: <EmptyPanel icon={DocIcon} title="Tenders" text="Ask for bulk quantities: list the materials, delivery site and deadline, and sellers bid with their materials and delivery prices." /> },
    { path: 'orders', label: 'Orders', icon: BagIcon, element: <BuyerOrders /> },
    account,
  ],
  seller: [
    { path: '', label: 'Overview', icon: GridIcon, element: <SellerOverview /> },
    { path: 'listings', label: 'Listings', icon: ShopIcon, element: <SellerListings /> },
    { path: 'orders', label: 'Orders', icon: BagIcon, element: <SellerSales /> },
    { path: 'partners', label: 'Pickup & partners', icon: TruckIcon, element: <SellerPartners /> },
    { path: 'payouts', label: 'Balance & payouts', icon: WalletIcon, element: <EmptyPanel icon={WalletIcon} title="Balance & payouts" text="Your sales minus the 10% Scan4Reuse commission. Request a payout once a delivery is confirmed; the Scan4Reuse team approves it." /> },
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
    { path: 'payouts', label: 'Payouts', icon: WalletIcon, element: <EmptyPanel icon={WalletIcon} title="Payout requests" text="Sellers and logistics companies request payouts from their balance. Approve to send the money with Stripe, or reject with a reason." /> },
    { path: 'activity', label: 'Activity', icon: ClockIcon, element: <AdminActivity /> },
    account,
  ],
}

export const ROLE_ICONS = { buyer: BagIcon, corporate: BuildingIcon, seller: ShopIcon, logistics: TruckIcon, admin: ShieldIcon }
