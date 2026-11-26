"use client"

import * as React from "react"
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react"

import { cn } from "@/lib/utils"

const POPUP_ANIMATION_CLASS =
  "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-[8rem] origin-(--radix-dropdown-menu-content-transform-origin) rounded-md border p-1"

const INDICATOR_ITEM_CLASS =
  "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"

function wrapSlotted<T extends React.ElementType>(Component: T, slot: string, baseClass?: string) {
  return function SlottedComponent({ className, ...props }: React.ComponentProps<T> & { className?: string }) {
    const Comp = Component as React.ElementType
    return <Comp data-slot={slot} className={baseClass ? cn(baseClass, className) : className} {...props} />
  }
}

const DropdownMenu = wrapSlotted(DropdownMenuPrimitive.Root, "dropdown-menu")
const DropdownMenuPortal = wrapSlotted(DropdownMenuPrimitive.Portal, "dropdown-menu-portal")
const DropdownMenuTrigger = wrapSlotted(DropdownMenuPrimitive.Trigger, "dropdown-menu-trigger")
const DropdownMenuGroup = wrapSlotted(DropdownMenuPrimitive.Group, "dropdown-menu-group")
const DropdownMenuRadioGroup = wrapSlotted(DropdownMenuPrimitive.RadioGroup, "dropdown-menu-radio-group")
const DropdownMenuSub = wrapSlotted(DropdownMenuPrimitive.Sub, "dropdown-menu-sub")

function DropdownMenuContent({
  className,
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        className={cn(
          POPUP_ANIMATION_CLASS,
          "max-h-(--radix-dropdown-menu-content-available-height) overflow-x-hidden overflow-y-auto shadow-md",
          className
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
}

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  inset?: boolean
  variant?: "default" | "destructive"
}) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "focus:bg-accent focus:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 dark:data-[variant=destructive]:focus:bg-destructive/20 data-[variant=destructive]:focus:text-destructive data-[variant=destructive]:*:[svg]:!text-destructive [&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

function wrapIndicatorItem<T extends React.ElementType>(
  Component: T,
  slot: string,
  indicatorIcon: React.ReactNode
) {
  return function IndicatorItem({ className, children, ...props }: React.ComponentProps<T> & { className?: string; children?: React.ReactNode }) {
    const Comp = Component as React.ElementType
    return (
      <Comp data-slot={slot} className={cn(INDICATOR_ITEM_CLASS, className)} {...props}>
        <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
          <DropdownMenuPrimitive.ItemIndicator>{indicatorIcon}</DropdownMenuPrimitive.ItemIndicator>
        </span>
        {children}
      </Comp>
    )
  }
}

const DropdownMenuCheckboxItem = wrapIndicatorItem(
  DropdownMenuPrimitive.CheckboxItem,
  "dropdown-menu-checkbox-item",
  <CheckIcon className="size-4" />
)

const DropdownMenuRadioItem = wrapIndicatorItem(
  DropdownMenuPrimitive.RadioItem,
  "dropdown-menu-radio-item",
  <CircleIcon className="size-2 fill-current" />
)

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label> & {
  inset?: boolean
}) {
  return (
    <DropdownMenuPrimitive.Label
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn(
        "px-2 py-1.5 text-sm font-medium data-[inset]:pl-8",
        className
      )}
      {...props}
    />
  )
}

const DropdownMenuSeparator = wrapSlotted(
  DropdownMenuPrimitive.Separator,
  "dropdown-menu-separator",
  "bg-border -mx-1 my-1 h-px"
)

const DropdownMenuShortcut = wrapSlotted(
  "span",
  "dropdown-menu-shortcut",
  "text-muted-foreground ml-auto text-xs tracking-widest"
)

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger> & {
  inset?: boolean
}) {
  return (
    <DropdownMenuPrimitive.SubTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        "focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto size-4" />
    </DropdownMenuPrimitive.SubTrigger>
  )
}

const DropdownMenuSubContent = wrapSlotted(
  DropdownMenuPrimitive.SubContent,
  "dropdown-menu-sub-content",
  `${POPUP_ANIMATION_CLASS} overflow-hidden shadow-lg`
)

export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
}
