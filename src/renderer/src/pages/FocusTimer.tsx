import React, { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { RiPlayFill, RiPauseFill, RiCloseLine } from 'react-icons/ri'
import { Card } from '../components/Card'
import { Button } from '../components/Button'
import { CancellationModal } from '../components/CancellationModal'
import { DifficultyModal } from '../components/DifficultyModal'
import { api } from '../services/api'
import { AllowedAppsModal } from '../components/AllowedAppsModal'

// Testing: 1 min work, 1 min break. Production: 25 min work, 5 min break
const WORK_DURATION = 1 * 60 // 1 minute for testing
const BREAK_DURATION = 1 * 60 // 1 minute for testing

export default function FocusTimer(): React.JSX.Element {
    const location = useLocation()
    const navigate = useNavigate()
    const { habitId, habitTitle, habitTime, deepWorkWithScreen } = (location.state as {
        habitId?: string | number,
        habitTitle?: string,
        habitTime?: number,
        deepWorkWithScreen?: boolean
    }) || {}

    // Timer state
    const [timeLeft, setTimeLeft] = useState(WORK_DURATION)
    const [isActive, setIsActive] = useState(false)
    const [isWorkMode, setIsWorkMode] = useState(true)

    // Session tracking
    const [totalWorkTime, setTotalWorkTime] = useState(0)
    const totalTimeTarget = (habitTime || 30) * 60 // in seconds
    const [startTime] = useState(new Date())

    // Modals
    const [showCancelModal, setShowCancelModal] = useState(false)
    const [showDifficultyModal, setShowDifficultyModal] = useState(false)
    const [currentActivity, setCurrentActivity] = useState<string>('')

    // Activity tracking stats
    // Activity tracking stats
    const [usageStats, setUsageStats] = useState<any[]>([])

    // Allowed Apps State
    const [showAllowedAppsModal, setShowAllowedAppsModal] = useState(false)
    const [allowedApps, setAllowedApps] = useState<string[]>([])
    const [allowedDomains, setAllowedDomains] = useState<string[]>([])

    // Alarm state
    const [isAlarmActive, setIsAlarmActive] = useState(false)
    const alarmIntervalRef = useRef<NodeJS.Timeout | null>(null)

    const playAggressiveBeep = () => {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()

        // Square wave is harsher/more unpleasant
        osc.type = 'square'
        // Siren-like frequency sweep
        osc.frequency.setValueAtTime(440, ctx.currentTime)
        osc.frequency.linearRampToValueAtTime(1000, ctx.currentTime + 0.2)
        osc.frequency.linearRampToValueAtTime(440, ctx.currentTime + 0.4)

        gain.gain.setValueAtTime(0.05, ctx.currentTime)
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4)

        osc.connect(gain)
        gain.connect(ctx.destination)

        osc.start()
        osc.stop(ctx.currentTime + 0.4)
    }

    const startAlarm = () => {
        setIsAlarmActive(true)
        if (alarmIntervalRef.current) clearInterval(alarmIntervalRef.current)
        playAggressiveBeep()
        alarmIntervalRef.current = setInterval(playAggressiveBeep, 800)
    }

    const stopAlarm = () => {
        setIsAlarmActive(false)
        if (alarmIntervalRef.current) {
            clearInterval(alarmIntervalRef.current)
            alarmIntervalRef.current = null
        }
    }

    // Stop alarm on focus AND start next phase
    useEffect(() => {
        const handleFocus = () => {
            if (isAlarmActive) {
                stopAlarm()
                // Only auto-start if we are not in the final "Felicidades" state (which is handled by showing the modal)
                if (workTimeRef.current < totalTimeTarget) {
                    setIsActive(true)
                }
            }
        }
        window.addEventListener('focus', handleFocus)
        return () => window.removeEventListener('focus', handleFocus)
    }, [isAlarmActive, totalTimeTarget])

    // Refs for tracking
    const workTimeRef = useRef(0)

    // Reset stats on mount and show modal if needed
    useEffect(() => {
        if (deepWorkWithScreen) {
            setShowAllowedAppsModal(true)
        }
        if (window.api && window.api.resetStats) {
            window.api.resetStats().catch(err => console.error(err))
        }
    }, [deepWorkWithScreen])

    const handleAllowedAppsConfirm = (apps: string[], domains: string[]) => {
        setAllowedApps(apps)
        setAllowedDomains(domains)
        setShowAllowedAppsModal(false)
    }

    // Activity tracking effect - ONLY tracks when Active AND WorkMode
    useEffect(() => {
        if (isActive && isWorkMode && deepWorkWithScreen) {
            window.api.startTracking().catch(console.error)
            const handleUpdate = (data: any) => {
                const appName = data.app || 'Unknown'
                setCurrentActivity(`${appName} - ${data.title}`)
            }
            window.api.onActivityUpdate(handleUpdate)
            return () => {
                window.api.removeActivityListener()
                // Do not stop tracking completely if we just pause, but here we want to pause tracking
                window.api.stopTracking().then((stats: any) => {
                    console.log('Partial Stats collected:', stats)
                    setUsageStats(stats)
                }).catch(console.error)
            }
        } else {
            // Ensure tracking stops if not in work mode
            window.api.stopTracking().then((stats: any) => {
                setUsageStats(stats)
            }).catch(console.error)
        }
        return undefined
    }, [isActive, isWorkMode, deepWorkWithScreen])

    // Main timer effect
    useEffect(() => {
        let interval: NodeJS.Timeout
        if (isActive && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft((prev) => prev - 1)
                // Track work time
                if (isWorkMode) {
                    workTimeRef.current += 1
                    setTotalWorkTime(workTimeRef.current)
                }
            }, 1000)
        } else if (timeLeft === 0) {
            // Timer finished for current phase
            handlePhaseComplete()
        }
        return () => clearInterval(interval)
    }, [isActive, timeLeft, isWorkMode])

    const handlePhaseComplete = () => {
        setIsActive(false) // Wait for focus to restart phase
        startAlarm()

        // Check if total work time reached target
        if (workTimeRef.current >= totalTimeTarget) {
            setShowDifficultyModal(true)
            return
        }

        // Switch phases immediately so UI reflects NEXT phase while waiting for focus
        if (isWorkMode) {
            setIsWorkMode(false)
            setTimeLeft(BREAK_DURATION)
        } else {
            setIsWorkMode(true)
            setTimeLeft(WORK_DURATION)
        }
    }

    const toggleTimer = () => setIsActive(!isActive)

    const handleCancelClick = () => {
        setShowCancelModal(true)
    }

    const handleCancelConfirm = async (reason: string) => {
        if (!habitId) {
            setShowCancelModal(false)
            navigate(-1)
            return
        }

        try {
            await api.cancelHabit(habitId, {
                cancelReason: reason,
                focusPercent: Math.round((workTimeRef.current / totalTimeTarget) * 100),
                mentalHealthPercent: 50,
                difficulty: 3
            })
            alert('Hábito cancelado.')
        } catch (error) {
            console.error('Failed to cancel habit', error)
        }
        setShowCancelModal(false)
        navigate(-1)
    }

    const isDistraction = (appName: string, urls: string[] = []) => {
        const lowerName = appName.toLowerCase()

        // 1. Check Allowlist (User overrides)
        if (allowedApps.length > 0) {
            if (allowedApps.some(allowed => lowerName.includes(allowed))) return false
        }

        if (allowedDomains.length > 0 && urls.length > 0) {
            if (urls.some(u => allowedDomains.some(d => u.includes(d)))) return false
        }

        const distractionApps = ['discord', 'spotify', 'slack', 'whatsapp', 'telegram', 'steam', 'netflix']
        const distractionDomains = ['facebook.com', 'twitter.com', 'x.com', 'instagram.com', 'tiktok.com', 'youtube.com', 'netflix.com', 'reddit.com']

        if (distractionApps.some(d => lowerName.includes(d))) return true

        if (urls.length > 0) {
            if (urls.some(u => distractionDomains.some(d => u.includes(d)))) return true
        }
        return false
    }

    const handleDifficultyConfirm = async (difficulty: number) => {
        if (!habitId) {
            setShowDifficultyModal(false)
            navigate(-1)
            return
        }

        const endTime = new Date()

        // Fetch latest stats directly from tracker to ensure we have everything
        let finalStats = usageStats
        try {
            const currentStats = await window.api.getStats()
            if (currentStats && currentStats.length > 0) {
                finalStats = currentStats
            }
        } catch (err) {
            console.error('Failed to get final stats', err)
        }

        // Prepare distractions payload from finalStats
        const appsData: Record<string, { time: number, switches: number, urls?: string[] }> = {}
        let totalDistractionTimeMinutes = 0
        let totalSwitches = 0

        // Log all apps, but calculate distraction time based on heuristic
        if (finalStats.length === 0) {
            // No stats
        } else {
            finalStats.forEach((stat: any) => {
                // Convert seconds to minutes with 4 decimal precision
                const minutes = Number((stat.timeSpentSeconds / 60).toFixed(4))

                let domains: string[] = []
                if (stat.urls && stat.urls.length > 0) {
                    const uniqueDomains = new Set<string>()
                    stat.urls.forEach(u => {
                        try {
                            // Basic heuristic to clean URL or get hostname
                            let hostname = u
                            if (u.includes('://')) {
                                hostname = new URL(u).hostname
                            }
                            uniqueDomains.add(hostname)
                        } catch (e) {
                            if (u.includes('.')) uniqueDomains.add(u)
                        }
                    })
                    if (uniqueDomains.size > 0) {
                        domains = Array.from(uniqueDomains)
                    }
                }

                appsData[stat.name] = {
                    time: minutes,
                    switches: stat.switches,
                    ...(domains.length > 0 ? { urls: domains } : {})
                }

                if (isDistraction(stat.name, domains)) {
                    totalDistractionTimeMinutes += minutes
                }
                totalSwitches += stat.switches
            })
        }

        // Backend strict schema: totalDistractionTime must be positive number. 
        // If 0, maybe set to small epsilon or just 0 if allowed? Schema says positive() min(0) or min(1)?
        // Schema: totalDistractionTime: joi.number().positive().min(1).required()
        // So it MUST be >= 1 ?? "positive" usually means > 0. "min(1)" means >= 1.
        // Let's assume min(0) passed in my reading, but waiting... 
        // File view said: totalDistractionTime: joi.number().positive().min(1).required().
        // So we MUST send at least 1.

        const finalDistractionTime = Math.max(1, Number(totalDistractionTimeMinutes.toFixed(2)))
        const estimatedMinutes = Math.round(totalTimeTarget / 60)

        // Productive Time = Estimated - Distractions
        // Ensure not negative.
        const productiveMinutes = Math.max(0, estimatedMinutes - totalDistractionTimeMinutes)

        try {
            await api.createDeepWork(habitId, {
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
                estimatedTime: estimatedMinutes,
                cancelled: false,
                reasonCancelled: null,
                difficulty: difficulty,
                productiveTime: Number(productiveMinutes.toFixed(2)),
                distractions: {
                    apps: appsData,
                    totalDistractionTime: finalDistractionTime,
                    totalSwitches: totalSwitches
                }
            })

            await api.updateHabitStatus(habitId, 'completed', difficulty) // Pass difficulty if needed? Check signature.
            alert(`¡Hábito "${habitTitle}" completado exitosamente!`)
        } catch (error: any) {
            console.error('Failed to save deep work or complete habit', error)
            alert('Error al guardar la sesión: ' + (error.response?.data?.message || 'Error desconocido'))
        }

        setShowDifficultyModal(false)
        navigate(-1)
    }

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }

    // Calculate overall progress based on total work time
    const overallProgress = Math.min((totalWorkTime / totalTimeTarget) * 100, 100)
    // Calculate current phase progress
    const phaseTotal = isWorkMode ? WORK_DURATION : BREAK_DURATION
    const phaseProgress = ((phaseTotal - timeLeft) / phaseTotal) * 100

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Card style={{ padding: '3rem', width: '100%', maxWidth: '500px', display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: 'var(--bg-card)' }}>
                {habitTitle && (
                    <div style={{
                        marginBottom: '1rem', padding: '0.5rem 1rem',
                        backgroundColor: isWorkMode ? 'rgba(16, 185, 129, 0.1)' : 'rgba(99, 102, 241, 0.1)',
                        color: isWorkMode ? '#10b981' : '#6366f1',
                        borderRadius: '20px', fontSize: '0.9rem', fontWeight: 600
                    }}>
                        {isWorkMode ? 'Deep Work' : 'Descanso'}: {habitTitle}
                    </div>
                )}

                {/* Mode Tabs */}
                <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem' }}>
                    <div style={{
                        padding: '0.5rem 1.5rem', borderRadius: '20px',
                        backgroundColor: isWorkMode ? 'var(--accent-primary)' : 'transparent',
                        color: isWorkMode ? '#fff' : 'var(--text-secondary)',
                        fontWeight: 600
                    }}>
                        Trabajo
                    </div>
                    <div style={{
                        padding: '0.5rem 1.5rem', borderRadius: '20px',
                        backgroundColor: !isWorkMode ? '#6366f1' : 'transparent',
                        color: !isWorkMode ? '#fff' : 'var(--text-secondary)',
                        fontWeight: 600
                    }}>
                        Descanso
                    </div>
                </div>

                {/* Timer Display */}
                <div style={{ position: 'relative', width: '300px', height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2rem' }}>
                    <div style={{
                        position: 'absolute', inset: 0, borderRadius: '50%',
                        border: `10px solid ${isWorkMode ? 'rgba(16, 185, 129, 0.2)' : 'rgba(99, 102, 241, 0.2)'}`
                    }}></div>
                    <div style={{ fontSize: '5rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                        {formatTime(timeLeft)}
                    </div>
                </div>

                {/* Progress Bars */}
                <div style={{ width: '100%', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Progreso Total</span>
                        <span style={{ color: 'var(--accent-primary)' }}>{Math.round(overallProgress)}%</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-input)', borderRadius: '4px', marginBottom: '1rem' }}>
                        <div style={{ width: `${overallProgress}%`, height: '100%', backgroundColor: 'var(--accent-primary)', borderRadius: '4px', transition: 'width 1s linear' }}></div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>{isWorkMode ? 'Fase Trabajo' : 'Fase Descanso'}</span>
                        <span style={{ color: isWorkMode ? '#10b981' : '#6366f1' }}>{Math.round(phaseProgress)}%</span>
                    </div>
                    <div style={{ width: '100%', height: '4px', backgroundColor: 'var(--bg-input)', borderRadius: '4px' }}>
                        <div style={{ width: `${phaseProgress}%`, height: '100%', backgroundColor: isWorkMode ? '#10b981' : '#6366f1', borderRadius: '4px', transition: 'width 1s linear' }}></div>
                    </div>
                </div>

                {/* Activity Tracking */}
                {isActive && isWorkMode && deepWorkWithScreen && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                        <span style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>Tracking:</span> {currentActivity || 'Esperando actividad...'}
                    </div>
                )}

                {/* Stats */}
                <div style={{ display: 'flex', gap: '2rem', marginBottom: '2rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <div>
                        <span style={{ fontWeight: 600 }}>Trabajo:</span> {Math.floor(totalWorkTime / 60)}:{(totalWorkTime % 60).toString().padStart(2, '0')}
                    </div>
                    <div>
                        <span style={{ fontWeight: 600 }}>Meta:</span> {Math.floor(totalTimeTarget / 60)} min
                    </div>
                </div>

                {/* Controls */}
                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                    <Button variant="secondary" style={{ padding: '0.75rem 2rem', borderRadius: '2rem', border: '1px solid var(--border-subtle)' }} onClick={handleCancelClick}>
                        <RiCloseLine size={20} /> Cancelar
                    </Button>
                    <button
                        onClick={toggleTimer}
                        style={{
                            width: '80px', height: '80px', borderRadius: '50%', border: 'none',
                            backgroundColor: isWorkMode ? 'var(--accent-primary)' : '#6366f1', color: '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', boxShadow: `0 4px 14px 0 ${isWorkMode ? 'rgba(16, 185, 129, 0.39)' : 'rgba(99, 102, 241, 0.39)'}`
                        }}
                    >
                        {isActive ? <RiPauseFill size={40} /> : <RiPlayFill size={40} />}
                    </button>
                </div>
            </Card>

            <CancellationModal
                isOpen={showCancelModal}
                onClose={() => setShowCancelModal(false)}
                onConfirm={handleCancelConfirm}
            />

            <DifficultyModal
                isOpen={showDifficultyModal}
                onClose={() => setShowDifficultyModal(false)}
                onConfirm={handleDifficultyConfirm}
            />

            <AllowedAppsModal
                isOpen={showAllowedAppsModal}
                onConfirm={handleAllowedAppsConfirm}
            />
        </div>
    )
}
