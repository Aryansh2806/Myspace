import React from 'react';
import {AbsoluteFill, random, useCurrentFrame, useVideoConfig} from 'remotion';

// Flames rising from the bottom. `height` is in px; 0 hides the fire.
export const Fire: React.FC<{height: number; opacity?: number}> = ({height, opacity = 1}) => {
	const frame = useCurrentFrame();
	const {width} = useVideoConfig();
	if (height <= 0) return null;

	const layers = [
		{color: '#C1121F', amp: 1, speed: 0.12, count: 9},
		{color: '#F77F00', amp: 0.8, speed: 0.17, count: 11},
		{color: '#FCBF49', amp: 0.55, speed: 0.23, count: 13},
	];

	return (
		<AbsoluteFill style={{opacity}}>
			<svg width={width} height={height + 200} style={{position: 'absolute', bottom: 0}} viewBox={`0 0 ${width} ${height + 200}`}>
				<defs>
					<filter id="glow">
						<feGaussianBlur stdDeviation="10" />
					</filter>
				</defs>
				{layers.map((l, li) => {
					const base = height + 200;
					const step = width / l.count;
					let d = `M0 ${base} `;
					for (let i = 0; i <= l.count; i++) {
						const x = i * step;
						const flick = Math.sin(frame * l.speed + i * 1.7 + li) * 0.25 + 0.75 + random(`f${li}-${i}`) * 0.3;
						const tip = base - height * l.amp * flick;
						const sway = Math.sin(frame * l.speed * 1.3 + i) * step * 0.25;
						d += `Q${x - step * 0.5} ${base - height * 0.25 * l.amp} ${x + sway} ${tip} `;
						d += `Q${x + step * 0.5} ${base - height * 0.25 * l.amp} ${x + step} ${base - height * 0.15 * l.amp} `;
					}
					d += `L${width} ${base} Z`;
					return (
						<g key={li}>
							<path d={d} fill={l.color} filter="url(#glow)" opacity={0.6} />
							<path d={d} fill={l.color} />
						</g>
					);
				})}
			</svg>
			<Embers height={height} />
		</AbsoluteFill>
	);
};

const Embers: React.FC<{height: number}> = ({height}) => {
	const frame = useCurrentFrame();
	const {width, height: H} = useVideoConfig();
	return (
		<>
			{new Array(40).fill(0).map((_, i) => {
				const life = 60 + random(`l${i}`) * 50;
				const t = ((frame + random(`o${i}`) * life) % life) / life;
				const x = random(`x${i}`) * width + Math.sin(frame * 0.08 + i) * 30;
				const y = H - height * 0.4 - t * height * 1.6;
				const s = 4 + random(`s${i}`) * 8;
				return (
					<div
						key={i}
						style={{
							position: 'absolute',
							left: x,
							top: y,
							width: s,
							height: s,
							borderRadius: '50%',
							background: i % 3 ? '#FCBF49' : '#F77F00',
							boxShadow: '0 0 12px #F77F00',
							opacity: (1 - t) * 0.9,
						}}
					/>
				);
			})}
		</>
	);
};
