import { BagIcon, BuildingIcon, ClockIcon, DocIcon, GridIcon, ShopIcon, TruckIcon, UserIcon, UsersIcon, WalletIcon, ShieldIcon } from '../Icons'
import { AccountPage } from './Account'
import { AdminActivity, AdminOverview, AdminUsers, AdminVerification } from './Admin'
import { BuyerOverview, CorporateOverview, LogisticsOverview, SellerOverview } from './Overviews'
import EmptyPanel from './EmptyPanel'

// Each role's dashboard: the pages in its menu. The first one opens after login.
const account = { path: 'account', label: 'Account', icon: UserIcon, element: <AccountPage /> }

export const DASHBOARDS = {
  buyer: [
    { path: '', label: 'Overview', icon: GridIcon, element: <BuyerOverview /> },
    { path: 'orders', label: 'Orders', icon: BagIcon, element: <EmptyPanel icon={BagIcon} title="Orders" text="What you buy in the marketplace appears here, with its delivery status and a live tracking link." to="/market" action="Browse the marketplace" /> },
    account,
  ],
  corporate: [
    { path: '', label: 'Overview', icon: GridIcon, element: <CorporateOverview /> },
    { path: 'tenders', label: 'Tenders', icon: DocIcon, element: <EmptyPanel icon={DocIcon} title="Tenders" text="Ask for bulk quantities: list the materials, delivery site and deadline, and sellers bid with their materials and delivery prices." /> },
    { path: 'orders', label: 'Orders', icon: BagIcon, element: <EmptyPanel icon={BagIcon} title="Orders" text="Orders from the marketplace and from awarded tenders appear here, with invoices for your company." to="/market" action="Browse the marketplace" /> },
    account,
  ],
  seller: [
    { path: '', label: 'Overview', icon: GridIcon, element: <SellerOverview /> },
    { path: 'listings', label: 'Listings', icon: ShopIcon, element: <EmptyPanel icon={ShopIcon} title="Listings" text="Publish the items of a scan report to the marketplace. Each listing keeps its photo, material, size and pickup address." to="/scans" action="Open my scans" /> },
    { path: 'orders', label: 'Orders', icon: BagIcon, element: <EmptyPanel icon={BagIcon} title="Orders" text="When someone buys your materials, the order and its pickup time appear here." /> },
    { path: 'partners', label: 'Logistics partners', icon: TruckIcon, element: <EmptyPanel icon={TruckIcon} title="Logistics partners" text="Choose which verified logistics companies may pick up your materials. Buyers see their delivery prices at checkout." /> },
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
