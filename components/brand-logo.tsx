import Image from "next/image";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  /** icon : mascotte EGEN seule ; full : logo EGEN complet ; civitas : logo de l'éditeur */
  variant?: "icon" | "full" | "civitas";
  className?: string;
  alt?: string;
};

const SOURCES = {
  icon: { src: "/brand/egen-logo-icon.png", width: 256, height: 256, alt: "EGEN" },
  full: { src: "/brand/egen-logo-full.png", width: 640, height: 260, alt: "EGEN" },
  civitas: { src: "/brand/civitas-logo-full.png", width: 392, height: 422, alt: "CIVITAS" },
} as const;

export function BrandLogo({ variant = "icon", className, alt }: BrandLogoProps) {
  const { src, width, height, alt: defaultAlt } = SOURCES[variant];
  return (
    <Image
      src={src}
      width={width}
      height={height}
      alt={alt ?? defaultAlt}
      className={cn("object-contain", className)}
      priority={variant !== "civitas"}
    />
  );
}
