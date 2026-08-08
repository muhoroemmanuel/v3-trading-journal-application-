"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Clock, Globe } from "lucide-react"

interface TradingSession {
  name: string
  city: string
  openUTC: string
  closeUTC: string
  timezone: string
  color: string
}

const tradingSessions: TradingSession[] = [
  {
    name: "Sydney",
    city: "Sydney",
    openUTC: "21:00",
    closeUTC: "06:00",
    timezone: "AEDT",
    color: "bg-blue-500",
  },
  {
    name: "Tokyo",
    city: "Tokyo",
    openUTC: "23:00",
    closeUTC: "08:00",
    timezone: "JST",
    color: "bg-red-500",
  },
  {
    name: "London",
    city: "London",
    openUTC: "07:00",
    closeUTC: "16:00",
    timezone: "GMT",
    color: "bg-green-500",
  },
  {
    name: "Frankfurt",
    city: "Frankfurt",
    openUTC: "07:00",
    closeUTC: "16:00",
    timezone: "CET",
    color: "bg-purple-500",
  },
  {
    name: "New York",
    city: "New York",
    openUTC: "12:00",
    closeUTC: "21:00",
    timezone: "EST",
    color: "bg-orange-500",
  },
]

const timeZones = [
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "New York (EST/EDT)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Frankfurt", label: "Frankfurt (CET/CEST)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Australia/Sydney", label: "Sydney (AEDT/AEST)" },
]

function convertTime(utcTime: string, targetTimezone: string): string {
  const today = new Date()
  const [hours, minutes] = utcTime.split(":").map(Number)

  // Create a UTC date with today's date and the specified time
  const utcDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), hours, minutes))

  if (targetTimezone === "UTC") {
    return utcTime
  }

  return utcDate.toLocaleTimeString("en-US", {
    timeZone: targetTimezone,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  })
}

function isSessionActive(openUTC: string, closeUTC: string): boolean {
  const now = new Date()
  const currentUTCHour = now.getUTCHours()
  const currentUTCMinute = now.getUTCMinutes()
  const currentTime = currentUTCHour * 60 + currentUTCMinute

  const [openHour, openMinute] = openUTC.split(":").map(Number)
  const [closeHour, closeMinute] = closeUTC.split(":").map(Number)
  const openTime = openHour * 60 + openMinute
  const closeTime = closeHour * 60 + closeMinute

  // Handle sessions that cross midnight
  if (openTime > closeTime) {
    return currentTime >= openTime || currentTime <= closeTime
  }

  return currentTime >= openTime && currentTime <= closeTime
}

export default function TradingSessions() {
  const [selectedTimezone, setSelectedTimezone] = useState("UTC")

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Clock className="h-5 w-5" />
            <div>
              <CardTitle>Trading Sessions</CardTitle>
              <CardDescription>Major forex trading session times</CardDescription>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Globe className="h-4 w-4" />
            <Select value={selectedTimezone} onValueChange={setSelectedTimezone}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timeZones.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Session</TableHead>
              <TableHead>Open Time</TableHead>
              <TableHead>Close Time</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tradingSessions.map((session) => {
              const isActive = isSessionActive(session.openUTC, session.closeUTC)
              const openTime = convertTime(session.openUTC, selectedTimezone)
              const closeTime = convertTime(session.closeUTC, selectedTimezone)

              return (
                <TableRow key={session.name}>
                  <TableCell className="font-medium">
                    <div className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded-full ${session.color}`} />
                      <span>{session.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono">{openTime}</TableCell>
                  <TableCell className="font-mono">{closeTime}</TableCell>
                  <TableCell>
                    <Badge variant={isActive ? "default" : "secondary"}>{isActive ? "Active" : "Closed"}</Badge>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        <div className="mt-4 text-sm text-muted-foreground">
          <p>
            Times are displayed in{" "}
            {selectedTimezone === "UTC" ? "UTC" : timeZones.find((tz) => tz.value === selectedTimezone)?.label}.
          </p>
          <p>Session status updates in real-time based on current UTC time.</p>
        </div>
      </CardContent>
    </Card>
  )
}
