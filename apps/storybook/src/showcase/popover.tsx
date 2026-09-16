"use client";

import {
  Button,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/design-system";
import { DemoSection } from "@/components/demo-section";

export default function PopoverShowcase() {
  return (
    <>
      <DemoSection title="Default">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">Open Popover</Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium leading-none">Dimensions</h4>
                <p className="text-sm text-muted-foreground">
                  Set the dimensions for the layer.
                </p>
              </div>
              <div className="grid gap-3">
                <div className="grid grid-cols-3 items-center gap-4">
                  <Label htmlFor="pop-width">Width</Label>
                  <Input
                    id="pop-width"
                    defaultValue="100%"
                    className="col-span-2"
                  />
                </div>
                <div className="grid grid-cols-3 items-center gap-4">
                  <Label htmlFor="pop-height">Height</Label>
                  <Input
                    id="pop-height"
                    defaultValue="25px"
                    className="col-span-2"
                  />
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </DemoSection>

      <DemoSection title="Positions">
        <div className="flex flex-wrap items-center gap-4">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">Top</Button>
            </PopoverTrigger>
            <PopoverContent side="top" className="w-auto">
              <p className="text-sm">Popover on top</p>
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">Right</Button>
            </PopoverTrigger>
            <PopoverContent side="right" className="w-auto">
              <p className="text-sm">Popover on right</p>
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">Bottom</Button>
            </PopoverTrigger>
            <PopoverContent side="bottom" className="w-auto">
              <p className="text-sm">Popover on bottom</p>
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">Left</Button>
            </PopoverTrigger>
            <PopoverContent side="left" className="w-auto">
              <p className="text-sm">Popover on left</p>
            </PopoverContent>
          </Popover>
        </div>
      </DemoSection>
    </>
  );
}
