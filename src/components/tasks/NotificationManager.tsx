"use client"

import { useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { isToday, isPast, parseISO } from "date-fns"

export function NotificationManager() {
    const supabase = createClient()

    useEffect(() => {
        checkDueTasks()
        requestNotificationPermission()
    }, [])

    const requestNotificationPermission = async () => {
        if (!("Notification" in window)) return
        if (Notification.permission === "default") {
            await Notification.requestPermission()
        }
    }

    const checkDueTasks = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: tasks } = await supabase
                .from("tasks" as any)
                .select("*")
                .eq("user_id", user.id)
                .neq("status", "done")
                .neq("status", "archived")
                .not("due_date", "is", null)

            if (!tasks) return

            (tasks as any[]).forEach(task => {
                if (!task.due_date) return
                const date = parseISO(task.due_date)

                // Check if shown recently to avoid spam (using localStorage)
                const lastNotified = localStorage.getItem(`notified-${task.id}`)
                const now = new Date().toDateString()

                if (lastNotified === now) return

                if (isToday(date)) {
                    sendNotification(`Task Due Today: ${task.title}`, {
                        body: "Don't forget to complete this!",
                        tag: task.id
                    })
                    localStorage.setItem(`notified-${task.id}`, now)
                } else if (isPast(date)) {
                    // Maybe don't spam for past tasks every reload, or just once
                    // sendNotification(`Overdue Task: ${task.title}`, { body: "This task is past due." })
                }
            })

        } catch (error) {
            console.error("Failed to check notifications", error)
        }
    }

    const sendNotification = (title: string, options?: NotificationOptions) => {
        // In-app toast
        toast(title, { description: options?.body })

        // Browser notification
        if ("Notification" in window && Notification.permission === "granted") {
            new Notification(title, options)
        }
    }

    return null // Renderless component
}
