"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@repo/design-system";
import { DemoSection } from "@/components/demo-section";

export default function AvatarShowcase() {
  return (
    <>
      <DemoSection title="With Image">
        <div className="flex items-center gap-4">
          <Avatar>
            <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
            <AvatarFallback>CN</AvatarFallback>
          </Avatar>
          <Avatar>
            <AvatarImage src="https://github.com/vercel.png" alt="@vercel" />
            <AvatarFallback>V</AvatarFallback>
          </Avatar>
        </div>
      </DemoSection>

      <DemoSection title="Fallback">
        <div className="flex items-center gap-4">
          <Avatar>
            <AvatarFallback>JD</AvatarFallback>
          </Avatar>
          <Avatar>
            <AvatarFallback>AB</AvatarFallback>
          </Avatar>
          <Avatar>
            <AvatarFallback>ZK</AvatarFallback>
          </Avatar>
        </div>
      </DemoSection>

      <DemoSection title="Sizes">
        <div className="flex items-center gap-4">
          <Avatar className="h-6 w-6 text-xs">
            <AvatarFallback>S</AvatarFallback>
          </Avatar>
          <Avatar className="h-10 w-10">
            <AvatarFallback>MD</AvatarFallback>
          </Avatar>
          <Avatar className="h-14 w-14 text-lg">
            <AvatarFallback>LG</AvatarFallback>
          </Avatar>
        </div>
      </DemoSection>
    </>
  );
}
