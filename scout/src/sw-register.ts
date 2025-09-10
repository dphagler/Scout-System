export function registerSW() {
  if ('serviceWorker' in navigator) {
    const swPath = `${import.meta.env.BASE_URL}sw.js`
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(swPath).then((reg) => {
        // Listen for SW messages to trigger a one-time reload when a new SW activates
        navigator.serviceWorker.addEventListener('message', (evt: MessageEvent) => {
          const data: any = evt.data
          if (data && data.type === 'sw-activated') {
            const already = sessionStorage.getItem('sw-reloaded') === '1'
            if (!already) {
              sessionStorage.setItem('sw-reloaded', '1')
              // Reload the page so the new cached shell + assets are used
              window.location.reload()
            }
          }
        })

        // Fallback: if controller changes (new SW takes control), reload once
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          const already = sessionStorage.getItem('sw-reloaded') === '1'
          if (!already) {
            sessionStorage.setItem('sw-reloaded', '1')
            window.location.reload()
          }
        })
      }).catch(console.error)
    })
  }
}
