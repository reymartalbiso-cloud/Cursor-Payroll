'use client';

import React from 'react';

interface VideoBackgroundProps {
    src: string;
    opacity?: number;
    className?: string;
}

export const VideoBackground: React.FC<VideoBackgroundProps> = ({
    src,
    opacity = 0.05,
    className = ""
}) => {
    return (
        <div
            className={`fixed inset-0 overflow-hidden bg-white dark:bg-[hsl(160,20%,5%)] ${className}`}
            style={{ zIndex: -1, pointerEvents: 'none' }}
            aria-hidden
        >
            <video
                autoPlay
                loop
                muted
                playsInline
                className="absolute min-w-full min-h-full object-cover pointer-events-none"
                style={{ opacity }}
            >
                <source src={src} type="video/mp4" />
                Your browser does not support the video tag.
            </video>
        </div>
    );
};
