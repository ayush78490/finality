'use client';

import { useCallback } from 'react';
import Particles from 'react-tsparticles';
import { loadSlim } from 'tsparticles-slim';
// Engine type is available from react-tsparticles
type Engine = any;

export default function ParticlesBackground() {
    const particlesInit = useCallback(async (engine: Engine) => {
        await loadSlim(engine);
    }, []);

    return (
        <Particles
            id="tsparticles"
            init={particlesInit}
            options={{
                background: {
                    color: {
                        value: 'transparent',
                    },
                },
                fpsLimit: 120,
                interactivity: {
                    events: {
                        onClick: {
                            enable: true,
                            mode: 'push',
                        },
                        onHover: {
                            enable: true,
                            mode: 'repulse',
                        },
                        resize: true,
                    },
                    modes: {
                        push: {
                            quantity: 4,
                        },
                        repulse: {
                            distance: 100,
                            duration: 0.4,
                        },
                    },
                },
                particles: {
                    color: {
                        value: '#ffffff',
                    },
                    links: {
                        color: '#ffffff',
                        distance: 150,
                        enable: true,
                        opacity: 0.2,
                        width: 1,
                    },
                    move: {
                        direction: 'none',
                        enable: true,
                        outModes: {
                            default: 'bounce',
                        },
                        random: false,
                        speed: 1,
                        straight: false,
                    },
                    number: {
                        density: {
                            enable: true,
                            area: 800,
                        },
                        value: 60,
                    },
                    opacity: {
                        value: 0.4,
                    },
                    shape: {
                        type: ['char'],
                        options: {
                            char: [
                                {
                                    value: ['₿', 'Ξ', '$', '◈', '⬡'],
                                    font: 'Arial',
                                    style: '',
                                    weight: '400',
                                    fill: true,
                                },
                            ],
                        },
                    },
                    size: {
                        value: { min: 12, max: 20 },
                    },
                    rotate: {
                        value: {
                            min: 0,
                            max: 360,
                        },
                        direction: 'random',
                        animation: {
                            enable: true,
                            speed: 5,
                            sync: false,
                        },
                    },
                },
                detectRetina: true,
            }}
            className="absolute inset-0 z-0"
        />
    );
}
