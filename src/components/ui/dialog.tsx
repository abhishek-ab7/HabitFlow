"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function createDialogSlot<T extends React.ElementType>(
  Component: T,
  slot: string,
  baseClass?: string
) {
  return function DialogSlot({ className, ...props }: React.ComponentProps<T> & { className?: string }) {
    const Comp = Component as React.ElementType;
    return (
      <Comp
        data-slot={slot}
        className={baseClass ? cn(baseClass, className) : className}
        {...props}
      />
    );
  };
}

const Dialog = createDialogSlot(DialogPrimitive.Root, 'dialog');
const DialogTrigger = createDialogSlot(DialogPrimitive.Trigger, 'dialog-trigger');
const DialogPortal = createDialogSlot(DialogPrimitive.Portal, 'dialog-portal');
const DialogClose = createDialogSlot(DialogPrimitive.Close, 'dialog-close');

const DialogOverlay = createDialogSlot(
  DialogPrimitive.Overlay,
  'dialog-overlay',
  'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50'
);

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 outline-none sm:max-w-lg",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

const DialogHeader = createDialogSlot('div', 'dialog-header', 'flex flex-col gap-2 text-center sm:text-left');
const DialogFooter = createDialogSlot('div', 'dialog-footer', 'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end');
const DialogTitle = createDialogSlot(DialogPrimitive.Title, 'dialog-title', 'text-lg leading-none font-semibold');
const DialogDescription = createDialogSlot(DialogPrimitive.Description, 'dialog-description', 'text-muted-foreground text-sm');

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
