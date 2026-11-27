import { TooltipWrapper } from "@/components/tooltip-wrapper";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { History } from "lucide-react";

export function HistoryButton({ className, ...props }: React.ComponentProps<typeof Button>) {
  return (
    <TooltipWrapper label="Version history" asChild>
      <Button variant="ghost" size="sm" className={cn(className)} {...props}>
        <History className="size-3.5" />
        <span className="hidden text-sm md:block">History</span>
      </Button>
    </TooltipWrapper>
  );
}
