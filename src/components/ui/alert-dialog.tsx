"use client"

import * as React from "react"
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

function AlertDialog({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Root>) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />
}

function AlertDialogTrigger({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Trigger>) {
  return (
    <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />
  )
}

function AlertDialogPortal({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Portal>) {
  return (
    <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...props} />
  )
}

function AlertDialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Overlay>) {
  return (
    <AlertDialogPrimitive.Overlay
      data-slot="alert-dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogContent({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Content>) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        data-slot="alert-dialog-content"
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg",
          className
        )}
        {...props}
      />
    </AlertDialogPortal>
  )
}

function createAlertSlot<P extends { className?: string }>(
  Component: React.ComponentType<P>,
  baseClass: string,
  slot?: string
) {
  return function AlertSlot({ className, ...props }: P) {
    const slotProp = slot ? { 'data-slot': slot } : {};
    return <Component {...slotProp} className={cn(baseClass, className)} {...(props as P)} />;
  };
}

const AlertDialogHeader = createAlertSlot(
  'div' as unknown as React.ComponentType<React.ComponentProps<'div'>>,
  'flex flex-col gap-2 text-center sm:text-left',
  'alert-dialog-header'
);

const AlertDialogFooter = createAlertSlot(
  'div' as unknown as React.ComponentType<React.ComponentProps<'div'>>,
  'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end',
  'alert-dialog-footer'
);

const AlertDialogTitle = createAlertSlot(
  AlertDialogPrimitive.Title,
  'text-lg font-semibold',
  'alert-dialog-title'
);

const AlertDialogDescription = createAlertSlot(
  AlertDialogPrimitive.Description,
  'text-muted-foreground text-sm',
  'alert-dialog-description'
);

const AlertDialogAction = createAlertSlot(AlertDialogPrimitive.Action, buttonVariants());

const AlertDialogCancel = createAlertSlot(
  AlertDialogPrimitive.Cancel,
  buttonVariants({ variant: 'outline' })
);

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
}
