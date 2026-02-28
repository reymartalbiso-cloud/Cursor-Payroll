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
        <div className={`fixed inset-0 z-[-1] overflow-hidden pointer-events-none bg-white ${className}`}>
            <video
                autoPlay
                loop
                muted
                playsInline
                className="absolute min-w-full min-h-full object-cover"
                style={{ opacity }}
            >
                <source src={src} type="video/mp4" />
                Your browser does not support the video tag.
            </video>
        </div>
    );
};
