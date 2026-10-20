import React from 'react';

// A cartoon Ravan head, drawn in a 200x260 box. `burn` (0..1) chars the face as it catches fire.
export const RavanHead: React.FC<{
	size: number;
	burn?: number;
	angry?: number;
	pupilShift?: number;
}> = ({size, burn = 0, angry = 0, pupilShift = 0}) => {
	const skin = mix('#F2A65A', '#3a1d10', burn);
	const skinShade = mix('#D9823B', '#24110a', burn);
	const gold = mix('#F4C430', '#5a3a10', burn);
	const goldDark = mix('#C8901A', '#3a2408', burn);
	const brow = -6 - angry * 8;

	return (
		<svg width={size} height={size * 1.3} viewBox="0 0 200 260" style={{overflow: 'visible'}}>
			{/* Crown */}
			<path d="M40 112 L60 40 L80 80 L100 8 L120 80 L140 40 L160 112 Z" fill={gold} stroke="#1a0f08" strokeWidth={5} strokeLinejoin="round" />
			<path d="M40 112 L160 112 L156 128 L44 128 Z" fill={goldDark} stroke="#1a0f08" strokeWidth={5} strokeLinejoin="round" />
			<circle cx={100} cy={8} r={8} fill="#C1121F" stroke="#1a0f08" strokeWidth={4} />
			<ellipse cx={100} cy={88} rx={14} ry={18} fill="#1E8C7E" stroke="#1a0f08" strokeWidth={4} />
			<circle cx={100} cy={88} r={6} fill="#C1121F" />
			{/* Ears + earrings */}
			<ellipse cx={34} cy={170} rx={12} ry={20} fill={skinShade} stroke="#1a0f08" strokeWidth={4} />
			<ellipse cx={166} cy={170} rx={12} ry={20} fill={skinShade} stroke="#1a0f08" strokeWidth={4} />
			<circle cx={32} cy={196} r={7} fill={gold} stroke="#1a0f08" strokeWidth={3} />
			<circle cx={168} cy={196} r={7} fill={gold} stroke="#1a0f08" strokeWidth={3} />
			{/* Face */}
			<path d="M42 126 L158 126 Q166 200 136 236 Q100 262 64 236 Q34 200 42 126 Z" fill={skin} stroke="#1a0f08" strokeWidth={5} />
			{/* Tilak */}
			<path d="M100 132 L94 160 L100 168 L106 160 Z" fill="#C1121F" />
			{/* Brows */}
			<path d={`M58 ${158 + brow} L92 ${166 - brow * 0.2}`} stroke="#1a0f08" strokeWidth={9} strokeLinecap="round" />
			<path d={`M142 ${158 + brow} L108 ${166 - brow * 0.2}`} stroke="#1a0f08" strokeWidth={9} strokeLinecap="round" />
			{/* Eyes */}
			<ellipse cx={76} cy={182} rx={15} ry={12} fill="#fff" stroke="#1a0f08" strokeWidth={4} />
			<ellipse cx={124} cy={182} rx={15} ry={12} fill="#fff" stroke="#1a0f08" strokeWidth={4} />
			<circle cx={76 + pupilShift} cy={183} r={6} fill="#1a0f08" />
			<circle cx={124 + pupilShift} cy={183} r={6} fill="#1a0f08" />
			{/* Nose */}
			<path d="M100 186 Q108 204 98 208" stroke="#1a0f08" strokeWidth={4} fill="none" strokeLinecap="round" />
			{/* Mustache */}
			<path d="M100 214 Q80 206 62 214 Q48 222 44 210 Q50 232 72 228 Q90 226 100 220 Q110 226 128 228 Q150 232 156 210 Q152 222 138 214 Q120 206 100 214 Z" fill="#1a0f08" />
			{/* Mouth */}
			<path d="M84 234 Q100 246 116 234" stroke="#1a0f08" strokeWidth={4} fill="#8a1c1c" />
		</svg>
	);
};

const mix = (a: string, b: string, t: number) => {
	const pa = hex(a);
	const pb = hex(b);
	const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * Math.min(1, Math.max(0, t))));
	return `rgb(${c[0]},${c[1]},${c[2]})`;
};

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
