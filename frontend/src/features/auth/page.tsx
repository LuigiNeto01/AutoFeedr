import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'

import { api } from '@/shared/lib/api'
import { setAccessToken } from '@/shared/lib/session'
import { useApiToast } from '@/shared/hooks/use-api-toast'
import { Button } from '@/shared/ui/button'
import { Card, CardDescription, CardTitle } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

type AuthForm = z.infer<typeof schema>

export function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const navigate = useNavigate()
  const toast = useApiToast()

  const form = useForm<AuthForm>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  const mutation = useMutation({
    mutationFn: async (values: AuthForm) =>
      mode === 'login' ? api.login(values) : api.register(values),
    onSuccess: (result) => {
      setAccessToken(result.access_token)
      toast.showSuccess(mode === 'login' ? 'Login realizado.' : 'Conta criada com sucesso.')
      navigate('/dashboard', { replace: true })
    },
    onError: (error) => toast.showError(error),
  })

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md">
        <CardTitle>AutoFeedr</CardTitle>
        <CardDescription className="mb-4">
          Acesse com sua conta para operar seu workspace.
        </CardDescription>

        <Tabs value={mode} onValueChange={(value) => setMode(value as 'login' | 'register')}>
          <TabsList className="w-full">
            <TabsTrigger className="flex-1" value="login">
              Login
            </TabsTrigger>
            <TabsTrigger className="flex-1" value="register">
              Criar conta
            </TabsTrigger>
          </TabsList>
          <TabsContent value="login" />
          <TabsContent value="register" />
        </Tabs>

        <form
          className="mt-4 space-y-3"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        >
          <div>
            <Label htmlFor="auth-email">Email</Label>
            <Input id="auth-email" type="email" {...form.register('email')} />
          </div>
          <div>
            <Label htmlFor="auth-password">Senha</Label>
            <Input id="auth-password" type="password" {...form.register('password')} />
          </div>
          <Button className="w-full" type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Processando...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
