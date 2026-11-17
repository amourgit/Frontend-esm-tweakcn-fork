"use client";

import { BrandLogo } from "@/components/brand-logo";
import { UserProfileDropdown } from "@/components/user-profile-dropdown";
import { PRODUCT_SHORT_NAME, PUBLISHER_NAME } from "@/lib/site";
import Link from "next/link";

export function Header() {
  return (
    <header className="border-b">
      <div className="flex items-center justify-between gap-2 p-4">
        <div className="flex items-center gap-1">
          <Link href="/editor/theme" className="flex items-center gap-2">
            <BrandLogo variant="icon" className="size-7" />
            <span className="hidden font-bold md:block">{PRODUCT_SHORT_NAME}</span>
          </Link>
        </div>
        <div className="flex items-center gap-3.5">
          <div className="text-muted-foreground hidden items-center gap-1.5 text-xs md:flex">
            <span>par</span>
            <BrandLogo variant="civitas" className="h-5 w-auto" />
            <span className="font-semibold tracking-wide">{PUBLISHER_NAME}</span>
          </div>
          <UserProfileDropdown />
        </div>
      </div>
    </header>
  );
}
