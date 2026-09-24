import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

interface ConfirmOptions {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  /** Red confirm button for destructive actions (default). Set false for a neutral action. */
  danger?: boolean
}

type ConfirmFn = (options: ConfirmOptions | string) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn>(() => Promise.resolve(false))

export function useConfirm() {
  return useContext(ConfirmContext)
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<{ opts: ConfirmOptions; resolve: (v: boolean) => void } | null>(null)

  const confirm = useCallback<ConfirmFn>((options) => {
    const opts = typeof options === 'string' ? { message: options } : options
    return new Promise<boolean>((resolve) => setPending({ opts, resolve }))
  }, [])

  const settle = (result: boolean) => {
    pending?.resolve(result)
    setPending(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => settle(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              {pending.opts.danger !== false && (
                <div className="p-2 bg-red-50 rounded-full flex-shrink-0">
                  <AlertTriangle className="text-red-500" size={20} />
                </div>
              )}
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  {pending.opts.title ?? 'Are you sure?'}
                </h2>
                <p className="text-sm text-gray-600 mt-1 whitespace-pre-line">{pending.opts.message}</p>
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6">
              <button className="btn-secondary" onClick={() => settle(false)}>
                {pending.opts.cancelLabel ?? 'Cancel'}
              </button>
              <button
                className={pending.opts.danger === false ? 'btn-primary' : 'btn-danger'}
                onClick={() => settle(true)}
              >
                {pending.opts.confirmLabel ?? 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}
