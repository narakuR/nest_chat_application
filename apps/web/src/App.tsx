import * as React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "./components/ui/button"
import { Textarea } from "./components/ui/textarea"
import { Input } from "./components/ui/input"
import { ScrollArea } from "./components/ui/scroll-area"
import { Switch } from "./components/ui/switch"
import { Label } from "./components/ui/label"
import { MessageCircle, Plus, Send, LogOut } from "lucide-react"
import { Avatar, AvatarImage, AvatarFallback } from "./components/ui/avatar"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "./components/ui/dropdown-menu"
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./components/ui/dialog"
import { FieldGroup, Field } from "./components/ui/field"

type Conversation = {
  id: number
  name: string
  createdAt?: string
}

type ChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  reasoning?: string
  createdAt?: string | null
}


const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:3000"

function App() {
  const userinfo = JSON.parse(localStorage.getItem('userinfo') ?? '{}') as { username: string, avatar: string, token: string }
  const authHeaders = useMemo(() => {
    return {
      "Authorization": `Bearer ${userinfo.token}`,
    }
  }, [userinfo.token])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversationId, setSelectedConversationId] = useState<
    number | null
  >(null)
  const [creatingConversation, setCreatingConversation] = useState(false)
  const [newConversationName, setNewConversationName] = useState("")

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [deepThink, setDeepThink] = useState(false)
  const [authMode, setAuthMode] = useState<"signin" | "register">("signin")
  const [authDialogOpen, setAuthDialogOpen] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  const currentConversation = useMemo(
    () => conversations.find((c) => c.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId],
  )

  useEffect(() => {
    void fetchConversations()
  }, [])

  useEffect(() => {
    if (selectedConversationId) {
      void fetchMessages(selectedConversationId)
    }
  }, [selectedConversationId])



  useEffect(() => {
    if (!messagesEndRef.current) return
    messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close()
    }
  }, [])

  async function fetchMessages(conversationId: number) {
    const res = await fetch(`${API_BASE}/conversation/${conversationId}`,
      {
        headers: authHeaders
      }
    )
    if (!res.ok) return
    const json = await res.json()
    const data = json.data
    setMessages(data.messages)
  }

  async function fetchConversations() {
    try {
      const res = await fetch(`${API_BASE}/conversation`, {
        headers: {
          ...authHeaders
        }
      })
      if (!res.ok) return
      const json = await res.json()
      const data = json.data as Conversation[];
      setConversations(data)
      if (data.length > 0 && selectedConversationId == null) {
        setSelectedConversationId(data[0].id)
      }
    } catch {
      // ignore
    }
  }

  async function handleCreateConversation(e?: React.FormEvent) {
    e?.preventDefault()
    if (!newConversationName.trim()) return
    setCreatingConversation(true)
    try {
      const res = await fetch(`${API_BASE}/conversation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders
        },
        body: JSON.stringify({ name: newConversationName.trim() }),
      })
      if (!res.ok) return
      const conversationRes = await res.json()
      const conversation = conversationRes.data as Conversation
      setConversations((prev) => [...prev, conversation])
      setSelectedConversationId(conversation.id)
      setMessages([])
      setNewConversationName("")
    } catch {
      // ignore
    } finally {
      setCreatingConversation(false)
    }
  }

  function ensureConversationName() {
    if (currentConversation) return currentConversation.name
    return "New conversation"
  }

  async function handleSend() {
    if (!input.trim() || sending) return

    let conversationId = selectedConversationId
    if (conversationId == null) {
      const autoName = `Conversation ${new Date().toLocaleString()}`
      try {
        const res = await fetch(`${API_BASE}/conversation`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders
          },
          body: JSON.stringify({ name: autoName }),
        })
        if (!res.ok) return
        const conversationRes = await res.json()
        const conversation = conversationRes.data as Conversation
        setConversations((prev) => [...prev, conversation])
        // setSelectedConversationId(conversation.id)
        conversationId = conversation.id
      } catch {
        return
      }
    }

    const uid = crypto.randomUUID()
    const content = input.trim()
    setInput("")
    setSending(true)
    eventSourceRef.current?.close()

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content,
    }
    const assistantMessage: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content: "",
      reasoning: "",
    }
    setMessages((prev) => [...prev, userMessage, assistantMessage])

    try {
      const res = await fetch(`${API_BASE}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders
        },
        body: JSON.stringify({
          content,
          conversationId,
          uid,
          deepThink,
        }),
      })
      if (!res.ok) {
        throw new Error("Failed to send message")
      }

      const es = new EventSource(`${API_BASE}/messages/${uid}`, {
      })
      eventSourceRef.current = es

      es.onmessage = (event) => {
        try {
          const eventData = JSON.parse(event.data)
          const payload = eventData.data
          setMessages((prev) => {
            const next = [...prev]
            const lastIndex = next.findIndex(
              (m) => m.id === assistantMessage.id,
            )
            if (lastIndex === -1) return prev
            const target = { ...next[lastIndex] }
            if (payload.type === "message") {
              target.content += payload.data
            } else if (payload.type === "reasoning") {
              target.reasoning = (target.reasoning ?? "") + payload.data
            } else if (payload.type === "done") {
              target.createdAt = payload.data
            }
            next[lastIndex] = target

            return next
          })

          if (payload.type === "done") {
            es.close()
            eventSourceRef.current = null
            setSending(false)
            if (selectedConversationId == null) {
              setSelectedConversationId(conversationId)
            }
          }
        } catch {
          // ignore parse error
        }
      }

      es.onerror = () => {
        es.close()
        eventSourceRef.current = null
        setSending(false)
      }
    } catch {
      setSending(false)
    }
  }

  async function handleSignIn(e?: React.FormEvent) {
    e?.preventDefault()
    const formData = new FormData(e?.target as HTMLFormElement)
    const username = formData.get('username') as string
    const password = formData.get('password') as string
    if (!username.trim() || !password.trim()) return
    const res = await fetch(`${API_BASE}/auth/signin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    })
    if (!res.ok) return
    const json = await res.json()
    const data = json.data
    localStorage.setItem('userinfo', JSON.stringify(data))
    setAuthDialogOpen(false)
    window.location.reload()
  }

  async function handleRegister(e?: React.FormEvent) {
    e?.preventDefault()
    const formData = new FormData(e?.target as HTMLFormElement)
    const username = formData.get('username') as string
    const password = formData.get('password') as string
    const confirmPassword = formData.get('confirmPassword') as string
    const avatar = formData.get('avatar') as File | null

    if (!username?.trim() || !password?.trim() || !confirmPassword?.trim()) {
      return
    }
    if (password !== confirmPassword) {
      console.error("Password and confirm password do not match")
      return
    }
    const submitData = new FormData()
    submitData.append('username', username)
    submitData.append('password', password)
    if (avatar) {
      submitData.append('avatar', avatar)
    }
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      body: submitData,
    })
    if (!res.ok) return
    // 注册成功后切换回登录模式
    setAuthMode("signin");
    (e?.target as HTMLFormElement).reset()
  }

  async function handleSignOut() {
    const res = await fetch(`${API_BASE}/auth/signout`, {
      method: "POST",
      headers: authHeaders
    })
    if (!res.ok) return
    localStorage.removeItem('userinfo')
    window.location.reload()
  }

  const disabledSend = !input.trim() || sending

  return (
    <div className="flex min-h-svh bg-background text-foreground max-h-svh overflow-hidden">
      <aside className="hidden w-64 flex-col border-r bg-card/40 p-4 sm:flex">
        <div className="mb-4 flex items-center gap-2">
          <MessageCircle className="size-5" />
          <div className="flex-1">
            <p className="text-sm font-semibold leading-tight">Conversation List</p>
            <p className="text-xs text-muted-foreground">
              Select or create a conversation
            </p>
          </div>
        </div>
        <form
          onSubmit={handleCreateConversation}
          className="mb-3 flex items-center gap-2"
        >
          <Input
            placeholder="New conversation name"
            value={newConversationName}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setNewConversationName(e.target.value)
            }
          />
          <Button
            type="submit"
            size="icon"
            variant="outline"
            disabled={creatingConversation || !newConversationName.trim()}
          >
            <Plus className="size-4" />
          </Button>
        </form>

        <ScrollArea className="flex-1 rounded-md border bg-background/40">
          <div className="p-2">
            {conversations.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                No conversations yet. Create one below.
              </p>
            ) : (
              conversations.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setSelectedConversationId(c.id)
                  }}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent ${selectedConversationId === c.id
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground"
                    }`}
                >
                  <span className="line-clamp-1">{c.name}</span>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </aside>

      <main className="flex min-h-svh flex-1 flex-col">
        <header className="flex items-center justify-between border-b bg-card/60 px-4 py-3">
          <div className="flex items-center gap-2">
            <MessageCircle className="size-5" />
            <div>
              <h1 className="text-sm font-semibold sm:text-base">
                {ensureConversationName()}
              </h1>
              <p className="text-xs text-muted-foreground">
                Streaming conversation based on DeepSeek
              </p>
            </div>
          </div>
          {userinfo?.username ?
            (<DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Avatar>
                  <AvatarImage
                    src={`${API_BASE}${userinfo.avatar}`}
                    alt="@shadcn"
                  />
                  <AvatarFallback>CN</AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut /> Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            ) : (
              <Dialog open={authDialogOpen} onOpenChange={setAuthDialogOpen}>
                <DialogTrigger asChild>
                  <Button>Sign In</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-sm">
                  <DialogHeader>
                    <DialogTitle>
                      {authMode === "signin" ? "Sign In" : "Register"}
                    </DialogTitle>
                    <DialogDescription>
                      {authMode === "signin"
                        ? "Sign in to your account to continue."
                        : "Create a new account to start chatting."}
                    </DialogDescription>
                  </DialogHeader>
                  <form
                    onSubmit={authMode === "signin" ? handleSignIn : handleRegister}
                  >
                    <FieldGroup>
                      <Field>
                        <Label htmlFor="username">Email</Label>
                        <Input id="username" name="username" />
                      </Field>
                      <Field>
                        <Label htmlFor="password">Password</Label>
                        <Input
                          id="password"
                          name="password"
                          type="password"
                        />
                      </Field>
                      {authMode === "register" && (
                        <>
                          <Field>
                            <Label htmlFor="confirmPassword">
                              Confirm Password
                            </Label>
                            <Input
                              id="confirmPassword"
                              name="confirmPassword"
                              type="password"
                            />
                          </Field>
                          <Field>
                            <Label htmlFor="avatar">Avatar</Label>
                            <Input
                              id="avatar"
                              name="avatar"
                              type="file"
                              accept="image/*"
                            />
                          </Field>
                        </>
                      )}
                      <Field>
                        <Button type="submit">
                          {authMode === "signin" ? "Sign In" : "Register"}
                        </Button>
                      </Field>
                    </FieldGroup>
                  </form>
                  <span className="text-xs text-muted-foreground">
                    {authMode === "signin" ? (
                      <>
                        Not registered?{" "}
                        <Button
                          type="button"
                          variant="link"
                          onClick={() => setAuthMode("register")}
                        >
                          Register
                        </Button>
                      </>
                    ) : (
                      <>
                        Already have an account?{" "}
                        <Button
                          type="button"
                          variant="link"
                          onClick={() => setAuthMode("signin")}
                        >
                          Sign In
                        </Button>
                      </>
                    )}
                  </span>
                </DialogContent>
              </Dialog>
            )
          }
        </header>

        <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4 max-h-[calc(100vh-60px)]">
          <ScrollArea className="flex-1 rounded-lg border bg-card/40 p-3 sm:p-4">
            <div className="flex flex-col gap-3 text-sm">
              {messages.length === 0 ? (
                <div className="flex h-40 flex-col items-center justify-center gap-2 text-center text-xs text-muted-foreground sm:text-sm">
                  <p>Start your first conversation.</p>
                  <p>Enter your question, the model will respond to you in a streaming manner.</p>
                </div>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.role === "user" ? "justify-end" : "justify-start"
                      }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg px-3 py-2 shadow-sm sm:max-w-[75%] sm:px-4 ${m.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                        }`}
                    >
                      {m.reasoning && (
                        <details className="mt-1 text-xs opacity-80" open>
                          <summary className="cursor-pointer select-none">
                            View reasoning process
                          </summary>
                          <p className="mt-1 whitespace-pre-wrap wrap-break-word">
                            {m.reasoning}
                          </p>
                        </details>
                      )}
                      <p className="whitespace-pre-wrap wrap-break-word">
                        {m.content || (m.role === "assistant" ? "Thinking..." : "")}
                      </p>

                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          <form
            className="flex flex-col gap-2 rounded-lg border bg-card/70 p-3 shadow-sm sm:p-4"
            onSubmit={(e) => {
              e.preventDefault()
              void handleSend()
            }}
          >
            <Textarea
              placeholder="Enter your question, support multiple lines..."
              value={input}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setInput(e.target.value)
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void handleSend()
                }
              }}
              rows={3}
            />

            <div className="flex items-center justify-between gap-2">

              <div className="flex items-center gap-2">
                <Label htmlFor="deepThink" className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground sm:text-sm">
                    Deep thinking
                  </span>
                </Label>
                <Switch
                  id="deepThink"
                  checked={deepThink}
                  onCheckedChange={setDeepThink}
                />
              </div>
              <div className="flex flex-1 items-center justify-end gap-2">
                <p className="hidden text-[11px] text-muted-foreground sm:block">
                  Enter to send, Shift + Enter to newline.
                </p>
                <Button
                  type="submit"
                  size="sm"
                  disabled={disabledSend}
                  className="gap-1.5"
                >
                  <Send className="size-4" />
                  {sending ? "Generating..." : "Send"}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}

export default App
