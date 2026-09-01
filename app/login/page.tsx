"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { LineChart, LockKeyhole, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/components/auth-provider"
import { toast } from "@/hooks/use-toast"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const { signIn, signUp } = useAuth()
  const router = useRouter()

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    try {
      if (isSignUp) {
        await signUp(email, password)
        toast({ title: "Account created", description: "Check your email to confirm your account." })
      } else {
        await signIn(email, password)
        toast({ title: "Welcome back!" })
        router.push("/")
      }
    } catch (error: any) {
      toast({ title: "Unable to continue", description: error.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <Card className="w-full max-w-md shadow-sm">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <LineChart className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl">{isSignUp ? "Create your account" : "Welcome back"}</CardTitle>
            <CardDescription>{isSignUp ? "Start building a clearer trading record." : "Sign in to continue to your trading journal."}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input className="min-h-11 pl-9 text-base" id="email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input className="min-h-11 pl-9 text-base" id="password" type="password" autoComplete={isSignUp ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} required />
              </div>
            </div>
            <Button className="min-h-11 w-full" type="submit" disabled={loading}>{loading ? "Loading..." : isSignUp ? "Create account" : "Sign in"}</Button>
            <Button type="button" variant="link" className="min-h-11 w-full" onClick={() => setIsSignUp((value) => !value)}>{isSignUp ? "Already have an account? Sign in" : "Need an account? Sign up"}</Button>
            {!isSignUp && <p className="text-center text-sm text-muted-foreground"><Link className="font-medium text-primary hover:underline" href="/">Continue without signing in</Link></p>}
          </form>
        </CardContent>
      </Card>
    </main>
  )
}

