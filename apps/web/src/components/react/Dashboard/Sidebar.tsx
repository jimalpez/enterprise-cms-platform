"use client";
import { LayoutDashboard, FileText, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface SidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (view: string) => void;
  currentView: string;
}

export function Sidebar({
  open,
  onOpenChange,
  onNavigate,
  currentView,
}: SidebarProps) {
  const menuItems = [
    {
      id: "dashboard",
      label: "Dashboard",
      link: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      id: "content",
      label: "Library Content",
      link: "/dashboard/content",
      icon: FileText,
    },
    {
      id: "users",
      label: "Users",
      link: "/dashboard/users",
      icon: User,
    },
  ];

  return (
    <aside
      className={cn(
        "bg-sidebar border-r border-sidebar-border transition-all duration-300 flex flex-col",
        open ? "w-64" : "w-20",
      )}>
      {/* Logo */}
      <div className="h-16 border-b border-sidebar-border flex items-center justify-between px-4">
        {open && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-sidebar-primary rounded-lg flex items-center justify-center">
              <span className="text-sidebar-primary-foreground font-bold text-sm">
                CM
              </span>
            </div>
            <span className="text-sidebar-foreground font-semibold text-sm">
              ContentHub
            </span>
          </div>
        )}
        {/* <Button
          variant="ghost"
          size="icon"
          onClick={() => onOpenChange(!open)}
          className="text-sidebar-foreground hover:bg-sidebar-accent">
          {open ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
        </Button> */}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-6 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <Link
              key={item.id}
              href={item.link}
              onClick={() => onNavigate(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent",
              )}>
              <Icon size={20} className="shrink-0" />
              {open && (
                <span className="text-sm font-medium">{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-3">
        <Button
          variant="ghost"
          size="icon"
          className="w-full text-sidebar-foreground hover:bg-sidebar-accent justify-start gap-3 px-3">
          <LogOut size={20} />
          {open && <span className="text-sm">Logout</span>}
        </Button>
      </div>
    </aside>
  );
}
