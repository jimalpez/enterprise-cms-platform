"use client";

import { Menu, Search, Bell, Settings, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface HeaderProps {
  onMenuClick: () => void;
}

export function DashboardHeader({ onMenuClick }: HeaderProps) {
  return (
    <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6 gap-4">
      <Button
        variant="ghost"
        size="icon"
        onClick={onMenuClick}
        className="lg:hidden">
        <Menu size={20} />
      </Button>

      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            size={18}
          />
          <Input
            placeholder="Search content..."
            className="pl-10 bg-secondary text-foreground placeholder:text-muted-foreground border-0"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="text-foreground">
          <Bell size={20} />
        </Button>
        <Button variant="ghost" size="icon" className="text-foreground">
          <Settings size={20} />
        </Button>
        <Button variant="ghost" size="icon" className="text-foreground">
          <User size={20} />
        </Button>
      </div>
    </header>
  );
}
