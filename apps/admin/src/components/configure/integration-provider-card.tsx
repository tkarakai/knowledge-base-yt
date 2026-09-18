import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/design-system";

type IntegrationTab = {
  value: string;
  label: string;
};

type IntegrationProviderCardProps = {
  title: string;
  description: string;
  tabs: IntegrationTab[];
};

export function IntegrationProviderCard({
  title,
  description,
  tabs,
}: IntegrationProviderCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={tabs[0]?.value}>
          <TabsList className="w-full justify-start overflow-x-auto">
            {tabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {tabs.map((tab) => (
            <TabsContent key={tab.value} value={tab.value} className="mt-4">
              <p className="text-sm text-muted-foreground">Not yet implemented.</p>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
