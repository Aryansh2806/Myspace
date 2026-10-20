import React from 'react';
import {AbsoluteFill, Easing, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {fontFamily} from './fonts';
import {Fire} from './Fire';
import {RavanHead} from './RavanHead';

const RED = '#C1121F';
const ORANGE = '#E8702A';
const INK = '#141414';
const PAPER = '#F4F1EA';

const EXCUSES = [
	'No leaves',
	'Budget nahi hai',
	'Next year pakka',
	"Boss won't approve",
	'Too hot',
	'Too cold',
	'Who will come?',
	'Kal plan karte hain',
	'Visa ka jhanjhat',
	'Mood nahi hai',
];

// Timeline (30fps)
const HEADS_IN = 90;
const EXCUSE_START = 205;
const EXCUSE_LEN = 12;
const BURN = 335;
const GOOD_VS_EVIL = 425;
const OUTRO = 525;
export const DURATION = 640;

type Word = {t: string; c?: string};

// Words fly up one after another.
const Headline: React.FC<{lines: Word[][]; size?: number; delay?: number; stagger?: number}> = ({lines, size = 92, delay = 0, stagger = 3}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	let n = 0;
	return (
		<div style={{fontFamily, fontWeight: 800, fontSize: size, lineHeight: 1.12, textAlign: 'center', color: INK, letterSpacing: -1}}>
			{lines.map((line, li) => (
				<div key={li}>
					{line.map((w, wi) => {
						const s = spring({frame: frame - delay - n++ * stagger, fps, config: {damping: 14, mass: 0.6}});
						return (
							<span
								key={wi}
								style={{
									display: 'inline-block',
									margin: '0 0.14em',
									color: w.c ?? INK,
									opacity: s,
									transform: `translateY(${(1 - s) * 60}px) scale(${0.85 + s * 0.15})`,
								}}
							>
								{w.t}
							</span>
						);
					})}
				</div>
			))}
		</div>
	);
};

const words = (s: string, c?: string): Word[] => s.split(' ').map((t) => ({t, c}));

const Horns: React.FC<{size: number; color?: string}> = ({size, color = RED}) => (
	<svg width={size} height={size * 0.5} viewBox="0 0 200 100">
		<path d="M20 100 Q10 40 40 0 Q36 50 70 90 Z" fill={color} />
		<path d="M180 100 Q190 40 160 0 Q164 50 130 90 Z" fill={color} />
	</svg>
);

const Logo: React.FC<{scale?: number; dark?: boolean}> = ({scale = 1, dark}) => (
	<div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', transform: `scale(${scale})`}}>
		<Horns size={120} color={dark ? '#FCBF49' : RED} />
		<div style={{fontFamily, fontWeight: 900, fontSize: 46, lineHeight: 0.95, color: dark ? '#fff' : INK, letterSpacing: 2, textAlign: 'center', marginTop: 2}}>
			TRAVEL
			<br />
			<span style={{color: dark ? '#FCBF49' : RED}}>DEVILS</span>
		</div>
	</div>
);

const Paper: React.FC = () => (
	<AbsoluteFill style={{background: PAPER}}>
		<svg width="100%" height="100%" style={{position: 'absolute', opacity: 0.35}}>
			<filter id="paper">
				<feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves={4} seed={7} />
				<feColorMatrix values="0 0 0 0 0.6  0 0 0 0 0.58  0 0 0 0 0.55  0 0 0 -1.4 1.1" />
			</filter>
			<rect width="100%" height="100%" filter="url(#paper)" />
		</svg>
		{/* Faint giant watermark, like a brand stamp behind the art */}
		<div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily, fontWeight: 900, fontSize: 900, color: 'rgba(0,0,0,0.03)', letterSpacing: -40}}>
			TD
		</div>
	</AbsoluteFill>
);

const Heads: React.FC = () => {
	const frame = useCurrentFrame();
	const {fps, width} = useVideoConfig();
	const burn = interpolate(frame, [BURN + 15, BURN + 60], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	const sink = interpolate(frame, [BURN + 45, BURN + 85], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.cubic)});
	if (frame < HEADS_IN || sink >= 1) return null;

	const active = Math.floor((frame - EXCUSE_START) / EXCUSE_LEN);
	const order = [4, 5, 3, 6, 2, 7, 1, 8, 0, 9]; // pop out from the middle

	return (
		<div style={{position: 'absolute', top: 1000, left: 0, width, height: 360}}>
			{new Array(10).fill(0).map((_, i) => {
				const size = 220 - Math.abs(i - 4.5) * 18;
				const x = 40 + i * ((width - 80) / 10) + (width - 80) / 20;
				const pop = spring({frame: frame - HEADS_IN - order.indexOf(i) * 4, fps, config: {damping: 10, mass: 0.5}});
				const isActive = frame >= EXCUSE_START && active === i && active < 10;
				const bounce = isActive ? Math.sin(((frame - EXCUSE_START) % EXCUSE_LEN) / EXCUSE_LEN * Math.PI) * 30 : 0;
				const shake = burn > 0 ? Math.sin(frame * 2.1 + i) * 6 * burn : 0;
				return (
					<div
						key={i}
						style={{
							position: 'absolute',
							left: x - size / 2 + shake,
							top: 200 - size * 0.75 - bounce + sink * 500,
							zIndex: Math.round(20 - Math.abs(i - 4.5) * 2) + (isActive ? 20 : 0),
							transform: `scale(${pop * (isActive ? 1.15 : 1)})`,
							transformOrigin: 'bottom center',
							opacity: 1 - sink,
						}}
					>
						<RavanHead size={size} burn={burn} angry={isActive || burn > 0 ? 1 : 0.3} pupilShift={isActive ? 0 : (i < 5 ? 4 : -4)} />
					</div>
				);
			})}
		</div>
	);
};

const ExcusePill: React.FC = () => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const idx = Math.floor((frame - EXCUSE_START) / EXCUSE_LEN);
	if (frame < EXCUSE_START || idx >= EXCUSES.length) return null;
	const local = (frame - EXCUSE_START) % EXCUSE_LEN;
	const s = spring({frame: local, fps, config: {damping: 12, mass: 0.4}});
	return (
		<div style={{position: 'absolute', top: 1440, width: '100%', display: 'flex', justifyContent: 'center'}}>
			<div
				style={{
					fontFamily,
					fontWeight: 800,
					fontSize: 64,
					color: '#fff',
					background: INK,
					padding: '22px 48px',
					borderRadius: 999,
					transform: `scale(${0.6 + s * 0.4}) rotate(${(idx % 2 ? 1 : -1) * 3}deg)`,
					boxShadow: `10px 10px 0 ${ORANGE}`,
				}}
			>
				"{EXCUSES[idx]}"
			</div>
			<div style={{position: 'absolute', top: 150, fontFamily, fontWeight: 700, fontSize: 40, color: RED}}>
				Excuse #{idx + 1}
			</div>
		</div>
	);
};

const FadeOut: React.FC<{at: number; children: React.ReactNode}> = ({at, children}) => {
	const frame = useCurrentFrame();
	const o = interpolate(frame, [at - 8, at], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	return <AbsoluteFill style={{opacity: o}}>{children}</AbsoluteFill>;
};

const TextBlock: React.FC<{top?: number; children: React.ReactNode}> = ({top = 420, children}) => (
	<div style={{position: 'absolute', top, left: 70, right: 70}}>{children}</div>
);

const Intro: React.FC = () => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const s = spring({frame: frame - 18, fps, config: {damping: 11}});
	const line = interpolate(frame, [0, 20], [0, 1], {extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
	return (
		<AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
			<div style={{fontFamily, fontWeight: 500, fontSize: 56, color: INK, letterSpacing: 6, opacity: line}}>HAPPY</div>
			<div style={{height: 6, width: 420 * line, background: ORANGE, margin: '18px 0'}} />
			<div style={{fontFamily, fontWeight: 900, fontSize: 150, color: RED, transform: `scale(${s})`, letterSpacing: -3}}>Dussehra</div>
			<div style={{marginTop: 60, opacity: interpolate(frame, [30, 45], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}}>
				<Logo scale={1.1} />
			</div>
		</AbsoluteFill>
	);
};

const DevilsWin: React.FC = () => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const horns = spring({frame: frame - 62, fps, config: {damping: 8, mass: 0.6}});
	const big = spring({frame: frame - 50, fps, config: {damping: 10}});
	return (
		<>
			<TextBlock top={360}>
				<Headline lines={[words('Good always wins'), words('over evil.')]} size={84} />
			</TextBlock>
			<TextBlock top={680}>
				<Headline lines={[words('But when it comes', '#555'), words('to travel...', '#555')]} size={64} delay={24} />
			</TextBlock>
			<div style={{position: 'absolute', top: 960, width: '100%', textAlign: 'center', transform: `scale(${big})`}}>
				<div style={{fontFamily, fontWeight: 800, fontSize: 80, color: INK, marginBottom: 90}}>the</div>
				<div style={{position: 'relative', display: 'inline-block'}}>
					<div style={{position: 'absolute', top: -120, left: '50%', transform: `translateX(-50%) scale(${horns}) rotate(${(1 - horns) * -20}deg)`, transformOrigin: 'bottom center'}}>
						<Horns size={300} />
					</div>
					<div style={{fontFamily, fontWeight: 900, fontSize: 200, color: RED, letterSpacing: -6, lineHeight: 1}}>DEVILS</div>
				</div>
				<div style={{fontFamily, fontWeight: 900, fontSize: 130, color: INK, lineHeight: 1.1}}>win.</div>
			</div>
		</>
	);
};

const Outro: React.FC = () => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const wipe = interpolate(frame, [0, 18], [0, 1500], {extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic)});
	const logo = spring({frame: frame - 14, fps, config: {damping: 10}});
	const tag = spring({frame: frame - 30, fps, config: {damping: 14}});
	const cta = spring({frame: frame - 48, fps, config: {damping: 12}});
	const pulse = 1 + Math.sin(frame * 0.25) * 0.03 * cta;
	return (
		<AbsoluteFill>
			<div style={{position: 'absolute', left: 540 - wipe, top: 960 - wipe, width: wipe * 2, height: wipe * 2, borderRadius: '50%', background: `radial-gradient(circle, #8B0A14 0%, #4A050B 70%)`}} />
			<AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
				<div style={{transform: `scale(${logo * 2.4})`, marginBottom: 200}}>
					<Logo dark />
				</div>
				<div style={{fontFamily, fontWeight: 800, fontSize: 70, color: '#fff', textAlign: 'center', lineHeight: 1.15, opacity: tag, transform: `translateY(${(1 - tag) * 40}px)`}}>
					Pack your bags,
					<br />
					<span style={{color: '#FCBF49'}}>not your excuses.</span>
				</div>
				<div
					style={{
						marginTop: 70,
						fontFamily,
						fontWeight: 800,
						fontSize: 44,
						color: INK,
						background: '#FCBF49',
						padding: '22px 52px',
						borderRadius: 999,
						transform: `scale(${cta * pulse})`,
					}}
				>
					DM us to plan your escape ✈️
				</div>
				<div style={{position: 'absolute', bottom: 110, fontFamily, fontWeight: 600, fontSize: 36, color: 'rgba(255,255,255,0.75)', letterSpacing: 4, opacity: cta}}>
					HAPPY DUSSEHRA 🔥
				</div>
			</AbsoluteFill>
		</AbsoluteFill>
	);
};

export const TravelDevilsDussehra: React.FC = () => {
	const frame = useCurrentFrame();
	const fireH = interpolate(frame, [BURN - 5, BURN + 30, GOOD_VS_EVIL - 10, GOOD_VS_EVIL + 15, OUTRO], [0, 620, 620, 240, 200], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
		easing: Easing.inOut(Easing.cubic),
	});
	const flash = interpolate(frame, [BURN + 10, BURN + 16, BURN + 30], [0, 0.55, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

	return (
		<AbsoluteFill style={{background: PAPER}}>
			<Paper />

			{/* Small brand mark, top-right, between intro and outro */}
			{frame > 75 && frame < OUTRO && (
				<div style={{position: 'absolute', top: 90, right: 70, opacity: interpolate(frame, [75, 90], [0, 1], {extrapolateRight: 'clamp'})}}>
					<Logo scale={0.75} />
				</div>
			)}

			<Sequence durationInFrames={75}>
				<FadeOut at={75}>
					<Intro />
				</FadeOut>
			</Sequence>

			<Sequence from={75} durationInFrames={EXCUSE_START - 10 - 75}>
				<FadeOut at={EXCUSE_START - 10 - 75}>
					<TextBlock top={460}>
						<Headline lines={[[{t: 'Ravan', c: ORANGE}, {t: 'had'}], [{t: '10', c: RED}, {t: 'heads.', c: RED}]]} size={130} />
					</TextBlock>
				</FadeOut>
			</Sequence>

			<Sequence from={EXCUSE_START - 10} durationInFrames={BURN - EXCUSE_START + 10}>
				<FadeOut at={BURN - EXCUSE_START + 10}>
					<TextBlock top={380}>
						<Headline lines={[words('And every head'), words('had an'), [{t: 'EXCUSE', c: ORANGE}, {t: 'to'}], words('never travel.')]} size={96} />
					</TextBlock>
				</FadeOut>
			</Sequence>

			<Sequence from={BURN} durationInFrames={GOOD_VS_EVIL - BURN}>
				<FadeOut at={GOOD_VS_EVIL - BURN}>
					<TextBlock top={380}>
						<Headline lines={[words('This Dussehra,'), [{t: 'burn', c: RED}, {t: 'the', c: RED}], [{t: 'excuses.', c: RED}]]} size={120} delay={6} />
					</TextBlock>
				</FadeOut>
			</Sequence>

			<Heads />
			<ExcusePill />

			<Sequence from={GOOD_VS_EVIL} durationInFrames={OUTRO - GOOD_VS_EVIL}>
				<DevilsWin />
			</Sequence>

			<Fire height={fireH} />
			<AbsoluteFill style={{background: '#FCBF49', opacity: flash, mixBlendMode: 'screen'}} />

			<Sequence from={OUTRO}>
				<Outro />
			</Sequence>
		</AbsoluteFill>
	);
};
