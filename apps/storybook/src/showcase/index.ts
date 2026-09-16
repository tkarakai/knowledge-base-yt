import type { ComponentType } from "react";

import AlertShowcase from "./alert";
import AlertDialogShowcase from "./alert-dialog";
import AnnouncementBannerShowcase from "./announcement-banner";
import AvatarShowcase from "./avatar";
import BadgeShowcase from "./badge";
import BreadcrumbShowcase from "./breadcrumb";
import ButtonShowcase from "./button";
import CardShowcase from "./card";
import CopyableFieldShowcase from "./copyable-field";
import CheckboxShowcase from "./checkbox";
import DialogShowcase from "./dialog";
import EnvironmentBannerShowcase from "./environment-banner";
import OfflineBannerShowcase from "./offline-banner";
import PasskeyUnsupportedAlertShowcase from "./passkey-unsupported-alert";
import DropdownMenuShowcase from "./dropdown-menu";
import InputShowcase from "./input";
import OtpInputShowcase from "./otp-input";
import PasswordStrengthMeterShowcase from "./password-strength-meter";
import PopoverShowcase from "./popover";
import ProgressShowcase from "./progress";
import RadioGroupShowcase from "./radio-group";
import SelectShowcase from "./select";
import SeparatorShowcase from "./separator";
import StyledQrCodeShowcase from "./styled-qr-code";
import SheetShowcase from "./sheet";
import SidebarShowcase from "./sidebar";
import SkeletonShowcase from "./skeleton";
import SwitchShowcase from "./switch";
import TableShowcase from "./table";
import TabsShowcase from "./tabs";
import TextareaShowcase from "./textarea";
import ToggleShowcase from "./toggle";
import TooltipShowcase from "./tooltip";

export const showcaseMap: Record<string, ComponentType> = {
  alert: AlertShowcase,
  "alert-dialog": AlertDialogShowcase,
  "announcement-banner": AnnouncementBannerShowcase,
  avatar: AvatarShowcase,
  badge: BadgeShowcase,
  breadcrumb: BreadcrumbShowcase,
  button: ButtonShowcase,
  card: CardShowcase,
  "copyable-field": CopyableFieldShowcase,
  checkbox: CheckboxShowcase,
  dialog: DialogShowcase,
  "environment-banner": EnvironmentBannerShowcase,
  "offline-banner": OfflineBannerShowcase,
  "passkey-unsupported-alert": PasskeyUnsupportedAlertShowcase,
  "dropdown-menu": DropdownMenuShowcase,
  input: InputShowcase,
  "otp-input": OtpInputShowcase,
  "password-strength-meter": PasswordStrengthMeterShowcase,
  popover: PopoverShowcase,
  progress: ProgressShowcase,
  "radio-group": RadioGroupShowcase,
  select: SelectShowcase,
  separator: SeparatorShowcase,
  sheet: SheetShowcase,
  sidebar: SidebarShowcase,
  skeleton: SkeletonShowcase,
  "styled-qr-code": StyledQrCodeShowcase,
  switch: SwitchShowcase,
  table: TableShowcase,
  tabs: TabsShowcase,
  textarea: TextareaShowcase,
  toggle: ToggleShowcase,
  tooltip: TooltipShowcase,
};
