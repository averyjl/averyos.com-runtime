import Link from 'next/link';
import { useRouter } from 'next/router';

const navItems = [
  { title: 'VaultChain Status', href: '/vault/vaultchain-status' },
  { title: 'Home', href: '/' },
  { title: 'Discover', href: '/discover' },
  { title: 'Viewer', href: '/viewer' },
  { title: 'Certificates', href: '/certificate' },
  { title: 'Diff', href: '/diff' },
  { title: 'Badges', href: '/VaultBridge/badges' },
  { title: 'About', href: '/about' },
  { title: 'Contact', href: '/contact' },
  { title: 'Privacy', href: '/privacy' },
  { title: 'Terms', href: '/terms' },
  { title: 'Register', href: '/witness/register' }
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <div className="drawer lg:drawer-open">
      <input id="nav-drawer" type="checkbox" className="drawer-toggle" />
      <div className="drawer-content p-4">{children}</div>
      <div className="drawer-side">
        <label htmlFor="nav-drawer" className="drawer-overlay"></label>
        <ul className="menu p-4 w-80 min-h-full bg-base-200 text-base-content">
          {navItems.map((item) => {
            const isActive =
              item.href === '/'
                ? router.pathname === '/'
                : router.pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={isActive ? 'active font-bold' : ''}
                >
                  {item.title}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
