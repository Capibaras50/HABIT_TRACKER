import { BrowserWindow } from 'electron'

interface ActivityResult {
    title: string
    owner: {
        name: string
        path?: string
        bundleId?: string
    }
    url?: string
    memoryUsage?: number
}

interface AppUsage {
    name: string
    timeSpentSeconds: number
    icon?: string
    urls?: string[]
    switches: number
}

export class ActivityTracker {
    private intervalId: NodeJS.Timeout | null = null
    private isTracking = false
    private stats: Map<string, { seconds: number, urls: Set<string>, switches: number }> = new Map()
    private lastAppName: string | null = null
    private mainWindow: BrowserWindow

    constructor(mainWindow: BrowserWindow) {
        this.mainWindow = mainWindow
    }

    public startTracking() {
        if (this.isTracking) return
        this.isTracking = true
        // Do NOT clear stats here to allow resuming. Explicit resetStats() needed for new session.
        this.lastAppName = null
        
        let lastTick = Date.now()

        // Poll every 500ms for better resolution, but accumulate exact delta
        this.intervalId = setInterval(async () => {
             if (!this.isTracking) return
             const now = Date.now()
             const deltaSeconds = (now - lastTick) / 1000
             lastTick = now

             try {
                // Dynamic import for ESM package in CJS/TS environment
                const activeWin = (await import('active-win')).default
                const result = await activeWin()
                
                if (result) {
                    this.processResult(result as ActivityResult, deltaSeconds)
                }
             } catch (error) {
                 console.error('Error tracking activity:', error)
             }
        }, 500) // 2Hz polling
    }

    public stopTracking(): AppUsage[] {
        this.isTracking = false
        if (this.intervalId) {
            clearInterval(this.intervalId)
            this.intervalId = null
        }
        return this.getStats()
    }

    private processResult(result: ActivityResult, deltaSeconds: number) {
        const appName = result.owner.name
        const current = this.stats.get(appName) || { seconds: 0, urls: new Set(), switches: 0 }
        
        // Accumulate precise float seconds
        current.seconds += deltaSeconds

        // Robust URL capture
        if (result.url) {
            current.urls.add(result.url)
        } else if (result.title) {
            // Fallback: Attempt to extract domain-like strings from title if URL is missing
            // This helps if active-win fails to get the URL property on some Windows setups
            const domainMatch = result.title.match(/([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}/)
            if (domainMatch) {
               // Only add if it looks strictly like a domain (avoid generic words)
               // current.urls.add(domainMatch[0]) 
               // actually, this matches 'Doc.tsx' or 'active-win.ts'. risks false positives.
               // Safer: Don't guess. If user demands URLs, active-win MUST provide them.
               // We will trust the process.
            }
        }
        
        // Track switch if app changed
        if (this.lastAppName !== appName) {
            current.switches += 1
            this.lastAppName = appName
        }
        
        this.stats.set(appName, current)
        
        // Optional: Send real-time updates to renderer
        this.mainWindow.webContents.send('activity-update', {
            app: appName,
            title: result.title,
            url: result.url
        })
    }

    public getStats(): AppUsage[] {
        const usage: AppUsage[] = []
        this.stats.forEach((data, name) => {
            usage.push({
                name,
                timeSpentSeconds: data.seconds,
                urls: Array.from(data.urls),
                switches: data.switches
            })
        })
        return usage.sort((a, b) => b.timeSpentSeconds - a.timeSpentSeconds)
    }

    public resetStats() {
        this.stats.clear()
        this.lastAppName = null
    }
}
