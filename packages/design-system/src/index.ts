/* ─── Utilities ─── */
export { cn } from "./lib/utils";
export {
  parseUserAgent,
  type ParsedUserAgent,
  type DeviceType,
} from "./lib/parse-user-agent";

/* ─── Hooks ─── */
export { useIsMobile } from "./hooks/use-mobile";
export { useNetworkStatus } from "./hooks/use-network-status";
export { usePasskeySupport } from "./hooks/use-passkey-support";

/* ─── Actions ─── */
export { Button, buttonVariants, type ButtonProps } from "./components/actions/button";
export { Toggle, toggleVariants } from "./components/actions/toggle";

/* ─── Data Display ─── */
export { Avatar, AvatarImage, AvatarFallback } from "./components/data-display/avatar";
export { Badge, badgeVariants, type BadgeProps } from "./components/data-display/badge";
export {
  DateTimeWithTimezone,
  type DateTimeWithTimezoneProps,
} from "./components/data-display/date-time-with-timezone";
export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
} from "./components/data-display/breadcrumb";
export { Progress } from "./components/data-display/progress";
export {
  CopyableField,
  type CopyableFieldProps,
} from "./components/data-display/copyable-field";
export {
  StyledQrCode,
  type StyledQrCodeProps,
  type ErrorCorrectionLevel,
  type ModuleStyle,
} from "./components/data-display/styled-qr-code";
export { Separator } from "./components/data-display/separator";
export { Skeleton } from "./components/data-display/skeleton";
export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from "./components/data-display/table";

/* ─── Feedback ─── */
export { Alert, AlertTitle, AlertDescription, alertVariants } from "./components/feedback/alert";
export {
  AnnouncementBanner,
  type AnnouncementBannerProps,
} from "./components/feedback/announcement-banner";
export {
  EnvironmentBanner,
  environmentBannerVariants,
  type EnvironmentBannerProps,
  type Environment,
} from "./components/feedback/environment-banner";
export { EnvironmentBannerWrapper } from "./components/feedback/environment-banner-wrapper";
export { OfflineBanner, type OfflineBannerProps } from "./components/feedback/offline-banner";
export {
  PasskeyUnsupportedAlert,
  type PasskeyUnsupportedAlertProps,
} from "./components/feedback/passkey-unsupported-alert";
export { Toaster, toast } from "sonner";
export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "./components/feedback/alert-dialog";

/* ─── Animation ─── */
export { SlideTransition } from "./components/slide-transition";

/* ─── Form ─── */
export { Calendar, type CalendarProps } from "./components/form/calendar";
export { Checkbox } from "./components/form/checkbox";
export {
  DateTimePicker,
  type DateTimePickerProps,
} from "./components/form/date-time-picker";
export { Input, inputVariants, type InputProps } from "./components/form/input";
export { PasswordInput, type PasswordInputProps } from "./components/form/password-input";
export { Label } from "./components/form/label";
export { RadioGroup, RadioGroupItem } from "./components/form/radio-group";
export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
} from "./components/form/select";
export {
  OtpInput,
  type OtpInputHandle,
  type OtpInputProps,
} from "./components/form/otp-input";
export { Switch } from "./components/form/switch";
export { Textarea, textareaVariants, type TextareaProps } from "./components/form/textarea";
export {
  TimezoneSelector,
  CURATED_TIMEZONES,
  type TimezoneEntry,
  type TimezoneGroup,
  type TimezoneSelectorProps,
} from "./components/form/timezone-selector";

/* ─── Layout ─── */
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "./components/layout/card";
export { Collapsible, CollapsibleTrigger, CollapsibleContent } from "./components/layout/collapsible";
export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "./components/layout/sidebar";
export { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/layout/tabs";

/* ─── Overlay ─── */
export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogClose,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./components/overlay/dialog";
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
} from "./components/overlay/dropdown-menu";
export {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverAnchor,
} from "./components/overlay/popover";
export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from "./components/overlay/sheet";
export {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "./components/overlay/tooltip";
