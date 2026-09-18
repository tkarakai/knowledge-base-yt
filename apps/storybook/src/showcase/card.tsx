"use client";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@repo/design-system";
import { DemoSection } from "@/components/demo-section";

export default function CardShowcase() {
  return (
    <>
      <DemoSection title="Basic Card">
        <Card className="max-w-sm">
          <CardHeader>
            <CardTitle>Card Title</CardTitle>
            <CardDescription>
              Card description goes here with supporting text.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Card content area for any elements.
            </p>
          </CardContent>
          <CardFooter>
            <Button>Action</Button>
          </CardFooter>
        </Card>
      </DemoSection>

      <DemoSection title="Form Card">
        <Card className="max-w-sm">
          <CardHeader>
            <CardTitle>Create Project</CardTitle>
            <CardDescription>
              Deploy your new project in one click.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="card-name">Name</Label>
              <Input id="card-name" placeholder="Project name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="card-desc">Description</Label>
              <Input id="card-desc" placeholder="Project description" />
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline">Cancel</Button>
            <Button>Create</Button>
          </CardFooter>
        </Card>
      </DemoSection>
    </>
  );
}
