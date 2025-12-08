import { Link, useLocation } from "wouter";
import { 
  Search, 
  MessageCircle, 
  Bell, 
  User, 
  Plus,
  Menu
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Header() {
  const [location] = useLocation();

  const navItems = [
    { name: "Properties", href: "#" },
    { name: "Vehicles", href: "#" },
    { name: "Classifieds", href: "#" },
    { name: "Services", href: "#" },
    { name: "Jobs", href: "#" },
    { name: "Rewards", href: "/", active: true },
  ];

  return (
    <header className="bg-[#00426D] text-white shadow-md">
      <div className="container mx-auto px-4 h-16 md:h-20 flex items-center justify-between">
        {/* Logo and Desktop Nav */}
        <div className="flex items-center gap-8">
          <Link href="/">
            <div className="flex flex-col cursor-pointer">
              <span className="text-2xl font-bold leading-none tracking-tighter">Qatar</span>
              <span className="text-xl font-light leading-none tracking-widest text-blue-200">LIVING</span>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-6">
            {navItems.map((item) => (
              <a 
                key={item.name} 
                href={item.href}
                className={`text-sm font-medium hover:text-blue-200 transition-colors ${item.active ? 'text-white' : 'text-blue-100/80'}`}
              >
                {item.name}
              </a>
            ))}
          </nav>
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-4 text-blue-100">
            <button className="hover:text-white"><Search className="h-5 w-5" /></button>
            <button className="hover:text-white"><MessageCircle className="h-5 w-5" /></button>
            <button className="hover:text-white"><Bell className="h-5 w-5" /></button>
          </div>
          
          <div className="h-8 w-[1px] bg-blue-500/50 hidden md:block"></div>

          <Link href="/create-offer">
            <Button className="bg-[#F47920] hover:bg-[#d66a1c] text-white font-semibold rounded-md px-6 hidden sm:flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Post Ad
            </Button>
          </Link>

          <div className="flex items-center gap-2 pl-2">
            <div className="h-8 w-8 rounded-full bg-blue-800 flex items-center justify-center border border-blue-400/30">
              <User className="h-4 w-4" />
            </div>
            <button className="lg:hidden text-white">
              <Menu className="h-6 w-6" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
