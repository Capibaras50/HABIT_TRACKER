import React, { useState } from 'react'
import { Card } from './Card'
import { Button } from './Button'

interface AllowedAppsModalProps {
    isOpen: boolean
    onConfirm: (apps: string[], domains: string[]) => void
}

export const AllowedAppsModal = ({ isOpen, onConfirm }: AllowedAppsModalProps): React.JSX.Element | null => {
    const [appsInput, setAppsInput] = useState('')
    const [domainsInput, setDomainsInput] = useState('')

    if (!isOpen) return null

    const handleConfirm = () => {
        const apps = appsInput.split(',').map(s => s.trim().toLowerCase()).filter(s => s.length > 0)
        const domains = domainsInput.split(',').map(s => s.trim().toLowerCase()).filter(s => s.length > 0)
        onConfirm(apps, domains)
    }

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
        }}>
            <Card style={{ padding: '2rem', width: '100%', maxWidth: '500px', backgroundColor: 'var(--bg-card)' }}>
                <h3 style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--text-primary)' }}>
                    Configuración de Deep Work
                </h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                    Para asegurar que el tiempo se mida correctamente, indica qué aplicaciones y sitios web son necesarios para tu trabajo. Estos NO se contarán como distracciones.
                </p>

                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                        Aplicaciones Permitidas (separadas por coma)
                    </label>
                    <input
                        style={{
                            width: '100%',
                            padding: '0.75rem',
                            borderRadius: '8px',
                            border: '1px solid var(--border-subtle)',
                            backgroundColor: 'var(--bg-input)',
                            color: 'var(--text-primary)',
                            fontSize: '0.9rem'
                        }}
                        placeholder="Ej: VS Code, Figma, Terminal"
                        value={appsInput}
                        onChange={(e) => setAppsInput(e.target.value)}
                    />
                </div>

                <div style={{ marginBottom: '2rem' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                        Dominios Permitidos (separados por coma)
                    </label>
                    <input
                        style={{
                            width: '100%',
                            padding: '0.75rem',
                            borderRadius: '8px',
                            border: '1px solid var(--border-subtle)',
                            backgroundColor: 'var(--bg-input)',
                            color: 'var(--text-primary)',
                            fontSize: '0.9rem'
                        }}
                        placeholder="Ej: github.com, stackoverflow.com, localhost"
                        value={domainsInput}
                        onChange={(e) => setDomainsInput(e.target.value)}
                    />
                </div>

                <Button
                    onClick={handleConfirm}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px' }}
                >
                    Comenzar Sesión
                </Button>
            </Card>
        </div>
    )
}
