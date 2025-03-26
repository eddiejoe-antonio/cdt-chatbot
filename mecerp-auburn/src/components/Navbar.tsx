// components/Navbar.tsx
import Link from 'next/link';

interface NavbarProps {
  logo: React.ReactNode;
}

const Navbar: React.FC<NavbarProps> = ({ logo }) => {
  return (
    <header className="flex items-center justify-between p-4 shadow-md">
      <div className="flex items-center">
        <Link href="/">{logo}</Link>
        <Link href="/">        <p className='px-8 text-md'><strong>MECERP Auburn</strong> Viewer</p>
        </Link>
      </div>
    </header>
  );
};

export default Navbar;
