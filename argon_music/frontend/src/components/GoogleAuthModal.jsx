import React, { useState, useEffect } from 'react'
import {
  X, Check, Sparkles, Heart, LogOut, ArrowRight, Loader2, Music, ShieldCheck, RefreshCw, Image, User
} from 'lucide-react'
import { Youtube } from './YouTubeTasteSyncModal'
import { getApiBase, hasBackend } from '../standaloneApi'

export function GoogleIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.17 0 9.97 0 12s.45 3.83 1.25 5.42l4.03-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </svg>
  )
}

export default function GoogleAuthModal({
  isOpen,
  onClose,
  googleUser,
  onLogin,
  onLogout,
  onSyncYouTubeLikes,
  isSyncingLikes = false
}) {
  const [customEmail, setCustomEmail] = useState('')
  const [customName, setCustomName] = useState('')
  const [customPicUrl, setCustomPicUrl] = useState('')
  const [showEditPic, setShowEditPic] = useState(false)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [isSyncingProfile, setIsSyncingProfile] = useState(false)

  // Try to sync authentic avatar from active Safari YouTube Music session
  useEffect(() => {
    if (isOpen && googleUser && hasBackend()) {
      fetch(`${getApiBase()}/safari/profile`)
        .then((r) => r.json())
        .then((data) => {
          if (data?.picture && data.picture !== googleUser.picture) {
            onLogin({ ...googleUser, picture: data.picture })
          }
        })
        .catch(() => {})
    }
  }, [isOpen, googleUser])

  if (!isOpen) return null

  const handleSignIn = async (e) => {
    if (e) e.preventDefault()
    const email = customEmail.trim()
    if (!email) return
    setIsLoggingIn(true)

    let finalPic = customPicUrl.trim()
    if (!finalPic && hasBackend()) {
      try {
        const res = await fetch(`${getApiBase()}/safari/profile`)
        if (res.ok) {
          const data = await res.json()
          if (data?.picture) finalPic = data.picture
        }
      } catch {}
    }

    setTimeout(() => {
      onLogin({
        name: customName.trim() || email.split('@')[0],
        email: email,
        picture: finalPic,
        connectedAt: Date.now(),
        provider: 'google'
      })
      setIsLoggingIn(false)
      onClose()
    }, 300)
  }

  const handleRefreshFromSafari = async () => {
    if (!hasBackend()) return
    setIsSyncingProfile(true)
    try {
      const res = await fetch(`${getApiBase()}/safari/profile`)
      if (res.ok) {
        const data = await res.json()
        if (data?.picture) {
          onLogin({ ...googleUser, picture: data.picture })
        }
      }
    } catch (e) {
      console.error('Profile refresh error:', e)
    } finally {
      setIsSyncingProfile(false)
    }
  }

  const handleUseLetterAvatar = () => {
    if (!googleUser) return
    onLogin({ ...googleUser, picture: '' })
    setShowEditPic(false)
  }

  const handleSaveCustomPic = (e) => {
    if (e) e.preventDefault()
    if (!googleUser) return
    onLogin({ ...googleUser, picture: customPicUrl.trim() })
    setShowEditPic(false)
  }

  const userInitial = (googleUser?.name || googleUser?.email || 'U')[0].toUpperCase()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 select-none">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-md bg-[#0e0e13] border border-[#242432] rounded-2xl shadow-2xl flex flex-col z-10 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#20202c] flex items-center justify-between bg-[#13131a]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shadow-xs">
              <GoogleIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">
                {googleUser ? 'Google Account Profile' : 'Connect Google & YouTube'}
              </h3>
              <p className="text-[11px] text-[#8e8e96] font-mono">
                {googleUser ? 'Verified account & taste synchronization' : 'Access your YouTube likes & personal profile'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#71717a] hover:text-white hover:bg-[#1c1c24] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-5">
          {googleUser ? (
            /* Logged-in State with Verified Avatar */
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#14141c] border border-emerald-500/30 flex items-center gap-3.5">
                {googleUser.picture ? (
                  <img
                    src={googleUser.picture}
                    alt=""
                    className="w-12 h-12 rounded-full object-cover border-2 border-emerald-500/50 shadow-md"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-rose-500 via-purple-600 to-indigo-600 text-white font-bold text-lg flex items-center justify-center border-2 border-white/20 shadow-md">
                    {userInitial}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-white truncate">
                      {googleUser.name || (googleUser.email ? googleUser.email.split('@')[0] : 'Google User')}
                    </span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" title="Connected" />
                  </div>
                  <div className="text-xs text-[#8e8e96] truncate mt-0.5 font-mono">
                    {googleUser.email || 'Connected'}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono mt-1">
                    <ShieldCheck className="w-3 h-3" />
                    <span>YouTube Music Synced</span>
                  </div>
                </div>
              </div>

              {/* Avatar Management Options */}
              <div className="flex items-center justify-between text-[11px] font-mono px-1">
                {hasBackend() && (
                  <button
                    onClick={handleRefreshFromSafari}
                    disabled={isSyncingProfile}
                    className="text-sky-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${isSyncingProfile ? 'animate-spin' : ''}`} />
                    <span>Sync from Safari Tab</span>
                  </button>
                )}
                <button
                  onClick={() => setShowEditPic((p) => !p)}
                  className="text-zinc-400 hover:text-white cursor-pointer ml-auto"
                >
                  {showEditPic ? 'Close Editor' : 'Customize Avatar'}
                </button>
              </div>

              {/* Avatar Editor Drawer */}
              {showEditPic && (
                <div className="p-3 rounded-xl bg-[#121218] border border-white/10 space-y-2.5 animate-in fade-in duration-100">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-white">Profile Photo Controls</span>
                    <button
                      onClick={handleUseLetterAvatar}
                      className="text-[11px] font-mono text-zinc-400 hover:text-rose-300 cursor-pointer"
                    >
                      Use Letter Avatar ("{userInitial}")
                    </button>
                  </div>
                  <form onSubmit={handleSaveCustomPic} className="flex gap-2">
                    <input
                      type="url"
                      value={customPicUrl}
                      onChange={(e) => setCustomPicUrl(e.target.value)}
                      placeholder="Paste image URL (e.g. https://...)"
                      className="flex-1 bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-rose-500 font-mono"
                    />
                    <button
                      type="submit"
                      disabled={!customPicUrl.trim()}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-xs text-white font-medium cursor-pointer"
                    >
                      Apply
                    </button>
                  </form>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2 pt-1">
                <button
                  onClick={() => {
                    onSyncYouTubeLikes()
                  }}
                  disabled={isSyncingLikes}
                  className="w-full py-2.5 px-4 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isSyncingLikes ? (
                    <Loader2 className="w-4 h-4 animate-spin text-rose-400" />
                  ) : (
                    <Youtube className="w-4 h-4 text-rose-400" />
                  )}
                  <span>{isSyncingLikes ? 'Syncing YouTube Liked Songs...' : 'Sync YouTube Music Likes & History'}</span>
                </button>

                <button
                  onClick={() => {
                    onLogout()
                    onClose()
                  }}
                  className="w-full py-2 px-4 rounded-xl bg-[#16161f] hover:bg-rose-500/10 border border-[#242432] hover:border-rose-500/30 text-[#a1a1aa] hover:text-rose-300 text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Disconnect Google Account</span>
                </button>
              </div>
            </div>
          ) : (
            /* Sign-In State */
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-[#14141c] border border-[#22222e] text-xs text-[#a1a1aa] leading-relaxed">
                Connect your personal Google account to automatically import your <strong>YouTube Music Liked Songs</strong>, private mixes, and generate an AI Sonic DNA tailored to your personal listening habits.
              </div>

              {/* Google Sign-In Form */}
              <form onSubmit={handleSignIn} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-[#a1a1aa] mb-1.5">
                    Google / YouTube Account Email
                  </label>
                  <input
                    type="email"
                    required
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.target.value)}
                    placeholder="name@gmail.com"
                    className="w-full px-3 py-2.5 rounded-xl bg-[#121217] border border-[#262634] text-xs text-[#f4f4f5] placeholder:text-[#6e6e78] focus:outline-none focus:border-sky-500/60 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-[#a1a1aa] mb-1.5">
                    Display Name or YouTube Handle (optional)
                  </label>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="Your name or handle..."
                    className="w-full px-3 py-2.5 rounded-xl bg-[#121217] border border-[#262634] text-xs text-[#f4f4f5] placeholder:text-[#6e6e78] focus:outline-none focus:border-sky-500/60"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!customEmail.trim() || isLoggingIn}
                  className="w-full py-3 px-4 rounded-xl bg-white hover:bg-[#f2f2f2] disabled:opacity-40 text-[#1f1f1f] text-xs font-semibold flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-md hover:shadow-lg active:scale-[0.99] mt-2"
                >
                  {isLoggingIn ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#4285F4]" />
                  ) : (
                    <GoogleIcon className="w-4 h-4" />
                  )}
                  <span>Sign in with Google</span>
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
